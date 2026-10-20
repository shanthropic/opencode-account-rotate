import type { Model } from "@opencode/plugin";
import type {
  SessionModelRequest,
  SessionRequestKind,
  SessionRetry,
} from "@opencode/plugin/promise/session";
import type { Adapter } from "../adapters/contract.js";
import { resolveAdapter } from "../adapters/registry.js";
import { Accounts } from "./accounts.js";
import { sameBinding, sameModel, snapshot } from "./model.js";
import type { Binding, Context } from "./types.js";

export interface Dispatch {
  sessionID: string;
  agent: string;
  model: Model.Ref;
  kind: SessionRequestKind;
  created: number;
  generation: number;
  chainID: number;
  ambiguous: boolean;
  finished: boolean;
  consumed: boolean;
  binding?: Binding;
  adapter?: Adapter;
  credentialID?: string;
  fingerprint?: string;
  preparedFingerprint?: string;
  route?: string;
  signature?: string;
  authorization?: { credentialID: string; prepared: boolean };
}

interface Permission {
  agent: string;
  model: Model.Ref;
  binding: Binding;
  adapterID: string;
  credentialID: string;
  chainID: number;
  created: number;
  invalid: boolean;
}

/** Tokens/bodies never retained. WS and HTTP fallback share one preparation. */
export class Dispatches {
  private slots = new Map<string, Dispatch>();
  private permissions = new Map<string, Permission>();
  private identities = new Map<string, { id?: string; until: number }>();
  private generation = 0;
  constructor(
    private ctx: Context,
    private accounts: (integrationID: string) => Accounts,
  ) {}

  async begin(event: SessionModelRequest): Promise<void> {
    if (event.kind !== "primary" && event.kind !== "compaction") return;
    this.prune();
    const permission = this.permissions.get(event.sessionID);
    if (permission?.invalid) this.stop();
    // Native primary/compaction work is serialized. An unfinished slot is not
    // evidence of overlap: successful sends never enter the retry hook.
    if (!this.slots.has(event.sessionID) && this.slots.size >= 512) {
      const disposable = [...this.slots].find(
        ([id, slot]) => !slot.authorization && !this.permissions.has(id),
      );
      if (!disposable) this.stop();
      this.slots.delete(disposable[0]);
    }
    const slot: Dispatch = {
      sessionID: event.sessionID,
      agent: event.agent,
      model: { ...event.model },
      kind: event.kind,
      created: Date.now(),
      generation: ++this.generation,
      chainID: permission?.chainID ?? this.generation,
      ambiguous: false,
      finished: false,
      consumed: false,
      authorization: permission
        ? { credentialID: permission.credentialID, prepared: false }
        : undefined,
    };
    this.slots.set(event.sessionID, slot);
    this.prune();
    const state = await snapshot(this.ctx, slot.model);
    if (!this.ensureCurrent(slot)) return;
    if (state) {
      slot.binding = state.binding;
      slot.adapter = resolveAdapter(state);
    }
    if (
      slot.authorization &&
      (!state ||
        !slot.adapter ||
        permission?.agent !== slot.agent ||
        permission.adapterID !== slot.adapter.id ||
        !sameBinding(permission.binding, state.binding) ||
        (slot.kind === "primary" && !sameModel(permission.model, slot.model)))
    )
      this.stop();
    if (permission && slot.kind === "primary")
      this.permissions.delete(event.sessionID);
  }

  current(slot: Dispatch): boolean {
    return (
      this.slots.get(slot.sessionID) === slot &&
      Date.now() - slot.created <= 30 * 60_000
    );
  }

  async observe(
    event: Pick<SessionModelRequest, "sessionID" | "agent" | "model" | "kind">,
    url: string,
    headers: Headers,
  ): Promise<void> {
    if (event.kind !== "primary" && event.kind !== "compaction") return;
    const slot = this.slots.get(event.sessionID);
    if (
      !slot ||
      !this.current(slot) ||
      slot.kind !== event.kind ||
      !sameModel(slot.model, event.model) ||
      slot.agent !== event.agent
    ) {
      if (slot) {
        slot.ambiguous = true;
        if (slot.authorization) this.stop();
      }
      return;
    }
    const adapter = slot.adapter;
    const binding = slot.binding;
    const state = await snapshot(this.ctx, slot.model);
    if (!this.ensureCurrent(slot)) return;
    if (
      !adapter ||
      !binding ||
      !state ||
      !sameBinding(binding, state.binding) ||
      resolveAdapter(state)?.id !== adapter.id
    ) {
      slot.ambiguous = true;
      if (slot.authorization) this.stop();
      return;
    }
    const accounts = this.accounts(binding.integrationID);
    const active = await accounts.active().catch(() => undefined);
    let evidence = await adapter.inspect(active, url, headers, state);
    if (!this.ensureCurrent(slot)) return;
    if (slot.authorization) {
      const expected = slot.authorization;
      if (
        slot.ambiguous ||
        !evidence ||
        !active ||
        active.connection.id !== expected.credentialID ||
        !adapter.ready(active, state) ||
        (await accounts.activeID()) !== expected.credentialID ||
        !this.current(slot)
      )
        this.stop();
      if (expected.prepared) {
        if (
          !adapter.replacePrepared ||
          evidence.route !== slot.route ||
          !slot.signature ||
          (await adapter.signature(state)) !== slot.signature ||
          (evidence.fingerprint !== slot.preparedFingerprint &&
            evidence.fingerprint !== slot.fingerprint)
        )
          this.stop();
        if (
          !this.current(slot) ||
          (await accounts.activeID()) !== expected.credentialID
        )
          this.stop();
        if (!adapter.replacePrepared(active, evidence.route, headers))
          this.stop();
        evidence = await adapter.inspect(active, url, headers, state);
      }
      if (!evidence?.matches || !this.current(slot)) this.stop();
    }
    if (!evidence) {
      slot.ambiguous = true;
      return;
    }
    if (evidence.matches && active) {
      const known = this.identities.get(evidence.fingerprint);
      if (!known && this.identities.size >= 256) {
        slot.ambiguous = true;
        if (slot.authorization) this.stop();
        return;
      }
      // A collision is sticky until expiry; never overwrite association authority.
      this.identities.set(evidence.fingerprint, {
        id:
          known && known.until > Date.now() && known.id !== active.connection.id
            ? undefined
            : active.connection.id,
        until: Date.now() + 30 * 60_000,
      });
      if (!this.identities.get(evidence.fingerprint)?.id)
        for (const candidate of this.slots.values())
          if (candidate.fingerprint === evidence.fingerprint)
            candidate.ambiguous = true;
    }
    const known = this.identities.get(evidence.fingerprint);
    if (!known?.id || known.until <= Date.now()) {
      slot.ambiguous = true;
      if (slot.authorization) this.stop();
      return;
    }
    if (
      !slot.finished &&
      ((slot.fingerprint && slot.fingerprint !== evidence.fingerprint) ||
        (slot.route && slot.route !== evidence.route))
    )
      slot.ambiguous = true;
    if (slot.ambiguous && slot.authorization) this.stop();
    const signature =
      slot.signature ?? (await adapter.signature(state).catch(() => ""));
    if (!this.ensureCurrent(slot)) return;
    if (
      slot.authorization &&
      ((await accounts.activeID()) !== slot.authorization.credentialID ||
        !this.current(slot))
    )
      this.stop();
    // Signature/selection reads can yield while another session discovers a
    // collision. Never dispatch using association authority captured before it.
    const finalIdentity = this.identities.get(evidence.fingerprint);
    if (
      !finalIdentity?.id ||
      finalIdentity.id !== known.id ||
      finalIdentity.until <= Date.now()
    )
      slot.ambiguous = true;
    if (slot.authorization && slot.ambiguous) this.stop();
    slot.finished = false;
    slot.consumed = false;
    slot.credentialID = known.id;
    slot.preparedFingerprint ??= evidence.fingerprint;
    slot.fingerprint = evidence.fingerprint;
    slot.route = evidence.route;
    slot.signature = signature;
    this.prune();
  }

  inspect(event: SessionRetry): Dispatch | undefined {
    const slot = this.slots.get(event.sessionID);
    if (
      !slot ||
      !this.current(slot) ||
      slot.agent !== event.agent ||
      !sameModel(slot.model, event.model)
    )
      return;
    return slot;
  }

  /** Finish every ordinary attempt; consume authority only for confirmed quota. */
  finish(event: SessionRetry, exhausted: boolean): Dispatch | undefined {
    const slot = this.inspect(event);
    if (!slot || slot.finished) return;
    slot.finished = true;
    const identity = slot.fingerprint
      ? this.identities.get(slot.fingerprint)
      : undefined;
    if (
      !exhausted ||
      slot.ambiguous ||
      slot.consumed ||
      !slot.credentialID ||
      identity?.id !== slot.credentialID ||
      identity.until <= Date.now() ||
      !slot.binding ||
      !slot.adapter
    )
      return;
    slot.consumed = true;
    return slot;
  }

  /** Reserve before activation; a failed transition must not drop its guard. */
  reserve(slot: Dispatch): boolean {
    this.prune();
    if (!this.current(slot) || slot.ambiguous || !slot.binding || !slot.adapter)
      return false;
    const pending = this.permissions.get(slot.sessionID);
    if (pending) pending.invalid = true;
    else if (slot.kind === "primary") {
      if (this.permissions.size >= 512) return false;
      this.permissions.set(slot.sessionID, {
        agent: slot.agent,
        model: { ...slot.model },
        binding: slot.binding,
        adapterID: slot.adapter.id,
        credentialID: slot.credentialID!,
        chainID: slot.chainID,
        created: Date.now(),
        invalid: true,
      });
    }
    return true;
  }

  async authorize(slot: Dispatch, credentialID: string): Promise<boolean> {
    if (!this.current(slot) || slot.ambiguous || !slot.binding || !slot.adapter)
      return false;
    const pending = this.permissions.get(slot.sessionID);
    if (pending) {
      // Compaction may transfer a pending primary expectation only after
      // verifying that primary's own binding/readiness on the selected account.
      if (
        pending.agent !== slot.agent ||
        !sameBinding(pending.binding, slot.binding) ||
        pending.adapterID !== slot.adapter.id ||
        pending.chainID !== slot.chainID ||
        pending.credentialID !== slot.credentialID
      )
        return false;
      const state = await snapshot(this.ctx, pending.model);
      const accounts = this.accounts(pending.binding.integrationID);
      const active = await accounts.active();
      if (
        !state ||
        !sameBinding(pending.binding, state.binding) ||
        resolveAdapter(state)?.id !== pending.adapterID ||
        !active ||
        active.connection.id !== credentialID ||
        !slot.adapter.ready(active, state) ||
        (await accounts.activeID()) !== credentialID ||
        !this.current(slot) ||
        this.permissions.get(slot.sessionID) !== pending
      )
        return false;
      pending.credentialID = credentialID;
      pending.invalid = false;
    } else if (slot.kind === "primary") return false;
    if (slot.kind === "compaction")
      slot.authorization = { credentialID, prepared: true };
    return true;
  }

  /** Native ordinary retries get fresh primary preparations, not inherited guards. */
  async rearm(slot: Dispatch): Promise<boolean> {
    const expected = slot.authorization;
    if (!expected || slot.kind !== "primary") return true;
    const identity = slot.fingerprint && this.identities.get(slot.fingerprint);
    if (
      slot.credentialID !== expected.credentialID ||
      !identity ||
      identity.id !== expected.credentialID ||
      identity.until <= Date.now() ||
      !this.reserve(slot)
    )
      return false;
    return this.authorize(slot, expected.credentialID);
  }
  clear(sessionID: string, created = Infinity): void {
    const slot = this.slots.get(sessionID);
    if (slot && created >= slot.created) this.slots.delete(sessionID);
    const pending = this.permissions.get(sessionID);
    if (pending && created >= pending.created)
      this.permissions.delete(sessionID);
  }
  dispose(): void {
    this.slots.clear();
    this.permissions.clear();
    this.identities.clear();
  }
  private stop(): never {
    throw new Error(
      "opencode-account-rotate: continuation changed during recovery; submit again",
    );
  }
  private ensureCurrent(slot: Dispatch): boolean {
    const current = this.current(slot);
    if (!current && slot.authorization) this.stop();
    return current;
  }
  private prune(): void {
    const now = Date.now();
    for (const [key, slot] of this.slots)
      if (now - slot.created > 30 * 60_000) this.slots.delete(key);
    for (const [key, identity] of this.identities)
      if (identity.until <= now) this.identities.delete(key);
    for (const [key, permission] of this.permissions)
      if (now - permission.created > 30 * 60_000) this.permissions.delete(key);
  }
}
