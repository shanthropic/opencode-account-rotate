import type { Context } from "./core/types.js";
import { Accounts } from "./core/accounts.js";
import { Dispatches } from "./core/dispatch.js";
import { Rotation } from "./core/rotation.js";
import { diagnostic } from "./core/diagnostics.js";

export async function setup(ctx: Context) {
    if (
      typeof ctx.credential?.activate !== "function" ||
      typeof ctx.integration?.connection?.active !== "function" ||
      typeof ctx.integration?.connection?.resolve !== "function" ||
      typeof ctx.session?.hook !== "function"
    ) {
      throw new Error(
        "opencode-account-rotate requires OpenCode V2 native activation and transport hooks (2.0.32+)",
      );
    }
    const controller = new AbortController();
    const integrations = new Map<string, { accounts: Accounts; rotation: Rotation }>();
    const get = (integrationID: string): { accounts: Accounts; rotation: Rotation } => {
      let entry = integrations.get(integrationID);
      if (!entry) {
        // Never evict active integration coordination and accidentally split a queue.
        if (integrations.size >= 32) throw new Error("Recovery integration capacity exceeded");
        const accounts = new Accounts(ctx, integrationID);
        entry = { accounts, rotation: new Rotation(ctx, accounts, dispatches, controller.signal) };
        integrations.set(integrationID, entry);
      }
      return entry;
    };
    const dispatches = new Dispatches(ctx, (id) => get(id).accounts);
    await ctx.session.hook(
      "model.request",
      (event) => dispatches.begin(event),
    );
    await ctx.session.hook(
      "http.request",
      async (event) => {
        await dispatches.observe(
          event,
          event.request.url,
          event.request.headers,
        );
      },
    );
    await ctx.session.hook(
      "experimental.ws.handshake",
      async (event) => {
        const headers = new Headers(event.headers);
        await dispatches.observe(event, event.url, headers);
        event.headers = Object.fromEntries(headers);
      },
    );
    await ctx.session.hook(
      "retry",
      async (event) => {
        const attempt = dispatches.inspect(event);
        const verdict = attempt?.adapter?.quota(event.error);
        const sent = dispatches.finish(event, verdict?.kind === "exhausted");
        if (verdict?.kind !== "exhausted") return;
        if (!sent) {
          diagnostic(
            "Quota failure could not be attributed unambiguously; core retry policy left unchanged.",
          );
          return;
        }
        try {
          await get(sent.binding!.integrationID).rotation.recover(event, sent, verdict.until);
        } catch {
          event.decision = { retry: false };
          if (!controller.signal.aborted)
            diagnostic(
              "Account recovery failed; quota retries stopped. Check native sign-in status.",
            );
        }
      },
    );

    // Cleanup only terminal flows; retry scheduling is not a completion boundary.
    const terminal = new Set([
      "session.step.ended",
      "session.step.failed",
      "session.compaction.ended",
      "session.compaction.failed",
      "session.execution.succeeded",
      "session.execution.failed",
      "session.execution.interrupted",
      "session.deleted",
    ]);
    const events = (async () => {
      try {
        for await (const event of ctx.event.subscribe({
          signal: controller.signal,
        })) {
          if (
            !terminal.has(event.type) ||
            !("created" in event) ||
            !("sessionID" in event.data) ||
            typeof event.data.sessionID !== "string"
          )
            continue;
          dispatches.clear(event.data.sessionID, event.created);
           for (const entry of integrations.values()) entry.rotation.clear(event.data.sessionID, event.created);
        }
      } catch {
        if (!controller.signal.aborted)
          diagnostic(
            "Lifecycle event stream ended; attribution uses bounded expiry until reload.",
          );
      }
    })();
    return async () => {
      controller.abort();
      dispatches.dispose();
      for (const entry of integrations.values()) { entry.rotation.dispose(); entry.accounts.dispose(); }
      integrations.clear();
      await events;
    };
}
