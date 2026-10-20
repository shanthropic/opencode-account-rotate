import type { SessionRetry } from "@opencode/plugin/promise/session";
import type { Account, Context } from "./types.js";
import type { Accounts } from "./accounts.js";
import type { Dispatch, Dispatches } from "./dispatch.js";
import { Coordinator } from "./coordinator.js";
import { sameBinding, snapshot } from "./model.js";
import { diagnostic } from "./diagnostics.js";

/** Instance is integration-bound: shared across providers using that integration. */
export class Rotation {
  private coordinator = new Coordinator();
  private cooldowns = new Map<string, number>();
  private chains = new Map<
    string,
    { tried: Set<string>; created: number; sessionID: string }
  >();
  private pending = new Set<{
    sessionID: string;
    created: number;
    controller: AbortController;
  }>();
  constructor(
    private ctx: Context,
    private accounts: Accounts,
    private dispatches: Dispatches,
    private signal: AbortSignal,
  ) {}

  recover(event: SessionRetry, sent: Dispatch, until: number): Promise<void> {
    if (this.pending.size >= 64)
      return Promise.reject(new Error("Recovery capacity exceeded"));
    const operation = {
      sessionID: event.sessionID,
      created: sent.created,
      controller: new AbortController(),
    };
    this.pending.add(operation);
    const signal = AbortSignal.any([this.signal, operation.controller.signal]);
    return this.coordinator
      .run(() => this.run(event, sent, until, signal))
      .finally(() => this.pending.delete(operation));
  }
  clear(sessionID: string, created = Infinity): void {
    for (const operation of this.pending)
      if (operation.sessionID === sessionID && created >= operation.created)
        operation.controller.abort();
    for (const [key, chain] of this.chains)
      if (chain.sessionID === sessionID && created >= chain.created)
        this.chains.delete(key);
  }
  dispose(): void {
    for (const operation of this.pending) operation.controller.abort();
    this.chains.clear();
    this.cooldowns.clear();
  }

  private async run(
    event: SessionRetry,
    sent: Dispatch,
    until: number,
    signal: AbortSignal,
  ): Promise<void> {
    event.decision = { retry: false };
    this.check(signal, sent);
    const failed = sent.credentialID!;
    const adapter = sent.adapter!;
    this.prune();
    if (!this.cooldowns.has(failed) && this.cooldowns.size >= 1024) return;
    this.cooldowns.set(
      failed,
      Math.max(this.cooldowns.get(failed) ?? 0, until),
    );
    const key = JSON.stringify([sent.sessionID, sent.binding, sent.chainID]);
    let chain = this.chains.get(key);
    if (!chain) {
      if (this.chains.size >= 512) return;
      chain = {
        tried: new Set<string>(),
        created: sent.created,
        sessionID: sent.sessionID,
      };
      this.chains.set(key, chain);
    }
    if (!chain.tried.has(failed) && chain.tried.size >= 1024) return;
    chain.tried.add(failed);
    const selected = await this.accounts.active();
    this.check(signal, sent);
    if (!selected) {
      diagnostic(
        "Native selection is not a saved account; automatic recovery stopped.",
      );
      return;
    }
    if (selected.connection.id !== failed) {
      if (
        !this.cooldowns.has(selected.connection.id) &&
        !chain.tried.has(selected.connection.id)
      )
        await this.resume(event, sent, selected, signal);
      return;
    }
    let entries = await this.accounts.list();
    let expected = failed;
    const seen = new Set<string>();
    for (let pass = 0; pass < 2; pass++) {
      const offset = entries.findIndex((entry) => entry.id === failed);
      const ordered = [
        ...entries.slice(offset + 1),
        ...entries.slice(0, offset + 1),
      ];
      for (const connection of ordered) {
        if (
          seen.has(connection.id) ||
          chain.tried.has(connection.id) ||
          this.cooldowns.has(connection.id)
        )
          continue;
        seen.add(connection.id);
        let candidate: Account | undefined;
        try {
          candidate = await this.accounts.resolve(connection);
        } catch {
          diagnostic(
            "A saved credential could not be resolved; trying the next account.",
          );
        }
        this.check(signal, sent);
        if (!candidate || adapter.capability(candidate) === "unsupported")
          continue;
        if (
          !(await this.bindingReady(sent)) ||
          (await this.accounts.activeID()) !== expected
        ) {
          diagnostic(
            "Native selection or provider binding changed; automatic activation stopped.",
          );
          return;
        }
        this.check(signal, sent);
        if (chain.tried.size >= 1024) return;
        await this.ctx.credential.activate({ credentialID: connection.id });
        this.check(signal, sent);
        expected = connection.id;
        // Local candidate exclusion is not a quota cooldown.
        chain.tried.add(connection.id);
        diagnostic("Activated another saved account.");
        if (adapter.capability(candidate) === "activate-only") continue;
        const status = await this.waitReady(candidate, sent, signal);
        if (status === "changed") return;
        if (status === "ready") {
          await this.resume(event, sent, candidate, signal);
          return;
        }
        diagnostic(
          "Activated account did not become ready for the selected model; trying the next account.",
        );
      }
      entries = await this.accounts.list();
    }
    diagnostic("No usable saved accounts remain; quota retries stopped.");
  }

  private async bindingReady(sent: Dispatch): Promise<boolean> {
    const state = await snapshot(this.ctx, sent.model);
    return (
      !!state &&
      !!sent.binding &&
      sameBinding(state.binding, sent.binding) &&
      !!sent.adapter?.matches(state)
    );
  }
  private async waitReady(
    account: Account,
    sent: Dispatch,
    signal: AbortSignal,
  ): Promise<"ready" | "changed" | "timeout"> {
    const deadline = Date.now() + 10_000;
    do {
      this.check(signal, sent);
      if ((await this.accounts.activeID()) !== account.connection.id)
        return "changed";
      const state = await snapshot(this.ctx, sent.model);
      this.check(signal, sent);
      if (state && sent.binding && !sameBinding(state.binding, sent.binding))
        return "changed";
      if (
        state &&
        sent.adapter?.ready(account, state) &&
        (await this.accounts.activeID()) === account.connection.id
      )
        return "ready";
      await pause(100, signal);
    } while (Date.now() < deadline);
    return "timeout";
  }
  private async resume(
    event: SessionRetry,
    sent: Dispatch,
    account: Account,
    signal: AbortSignal,
  ): Promise<void> {
    if ((await this.waitReady(account, sent, signal)) !== "ready") return;
    this.check(signal, sent);
    if (sent.kind === "compaction") {
      const state = await snapshot(this.ctx, sent.model);
      if (
        !state ||
        !sent.route ||
        !sent.adapter?.replacePrepared ||
        !sent.adapter.preparedCompatible?.(account, sent.route) ||
        !sent.signature ||
        sent.signature !== (await sent.adapter.signature(state))
      ) {
        diagnostic(
          "Account switched, but prepared compaction needs a fresh run. Submit again to continue.",
        );
        return;
      }
    }
    if ((await this.accounts.activeID()) !== account.connection.id) return;
    this.check(signal, sent);
    if (this.dispatches.authorize(sent, account.connection.id))
      event.decision = { retry: true, delay: 0 };
  }
  private check(signal: AbortSignal, sent: Dispatch): void {
    if (signal.aborted || sent.ambiguous || !this.dispatches.current(sent))
      throw new Error("Account recovery cancelled or superseded");
  }
  private prune(): void {
    const now = Date.now();
    for (const [key, until] of this.cooldowns)
      if (until <= now) this.cooldowns.delete(key);
    for (const [key, chain] of this.chains)
      if (now - chain.created > 30 * 60_000) this.chains.delete(key);
  }
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error("Recovery cancelled"));
    const abort = () => {
      clearTimeout(timer);
      reject(new Error("Recovery cancelled"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
