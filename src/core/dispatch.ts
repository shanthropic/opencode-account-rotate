import type { Model } from "@opencode/plugin";
import type { SessionModelRequest, SessionRequestKind, SessionRetry } from "@opencode/plugin/promise/session";
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

/** Tokens/bodies never retained. WS and HTTP fallback share one preparation. */
export class Dispatches {
  private slots = new Map<string, Dispatch>();
  private identities = new Map<string, { id?: string; until: number }>();
  private generation = 0;
  constructor(private ctx: Context, private accounts: (integrationID: string) => Accounts) {}

  async begin(event: SessionModelRequest): Promise<void> {
    if (event.kind !== "primary" && event.kind !== "compaction") return;
    this.prune();
    const previous = this.slots.get(event.sessionID);
    const follows = previous?.finished && sameModel(previous.model, event.model) && previous.agent === event.agent;
    const slot: Dispatch = {
      sessionID: event.sessionID, agent: event.agent, model: { ...event.model }, kind: event.kind,
      created: Date.now(), generation: ++this.generation,
      chainID: follows ? previous.chainID : this.generation,
      ambiguous: !!previous && !previous.finished, finished: false, consumed: false,
      authorization: follows ? previous.authorization : undefined,
    };
    this.slots.set(event.sessionID, slot);
    if (previous?.authorization && !follows) this.stop();
    const state = await snapshot(this.ctx, slot.model);
    if (!this.current(slot)) return;
    if (state) { slot.binding = state.binding; slot.adapter = resolveAdapter(state); }
    if (slot.authorization && (!state || !slot.adapter || !previous?.binding || !sameBinding(previous.binding, state.binding))) this.stop();
  }

  current(slot: Dispatch): boolean {
    return this.slots.get(slot.sessionID) === slot && Date.now() - slot.created <= 30 * 60_000;
  }

  async observe(event: Pick<SessionModelRequest, "sessionID" | "agent" | "model" | "kind">, url: string, headers: Headers): Promise<void> {
    if (event.kind !== "primary" && event.kind !== "compaction") return;
    const slot = this.slots.get(event.sessionID);
    if (!slot || !this.current(slot) || slot.kind !== event.kind || !sameModel(slot.model, event.model) || slot.agent !== event.agent) {
      if (slot) { slot.ambiguous = true; if (slot.authorization) this.stop(); }
      return;
    }
    const adapter = slot.adapter;
    const binding = slot.binding;
    const state = await snapshot(this.ctx, slot.model);
    if (!this.current(slot)) return;
    if (!adapter || !binding || !state || !sameBinding(binding, state.binding) || resolveAdapter(state)?.id !== adapter.id) {
      slot.ambiguous = true;
      if (slot.authorization) this.stop();
      return;
    }
    const accounts = this.accounts(binding.integrationID);
    const active = await accounts.active().catch(() => undefined);
    let evidence = await adapter.inspect(active, url, headers, state);
    if (!this.current(slot)) return;
    if (slot.authorization) {
      const expected = slot.authorization;
      if (slot.ambiguous || !evidence || !active || active.connection.id !== expected.credentialID || !adapter.ready(active, state) ||
        (await accounts.activeID()) !== expected.credentialID || !this.current(slot)) this.stop();
      if (expected.prepared) {
        if (!adapter.replacePrepared || evidence.route !== slot.route ||
          !slot.signature || await adapter.signature(state) !== slot.signature ||
          (evidence.fingerprint !== slot.preparedFingerprint && evidence.fingerprint !== slot.fingerprint)) this.stop();
        if (!this.current(slot) || (await accounts.activeID()) !== expected.credentialID) this.stop();
        if (!adapter.replacePrepared(active, evidence.route, headers)) this.stop();
        evidence = await adapter.inspect(active, url, headers, state);
      }
      if (!evidence?.matches || !this.current(slot)) this.stop();
    }
    if (!evidence) { slot.ambiguous = true; return; }
    if (evidence.matches && active) {
      const known = this.identities.get(evidence.fingerprint);
      // A collision is sticky until expiry; never overwrite association authority.
      this.identities.set(evidence.fingerprint, {
        id: known && known.until > Date.now() && known.id !== active.connection.id ? undefined : active.connection.id,
        until: Date.now() + 30 * 60_000,
      });
    }
    const known = this.identities.get(evidence.fingerprint);
    if (!known?.id || known.until <= Date.now()) { slot.ambiguous = true; return; }
    if (!slot.finished && slot.fingerprint && slot.fingerprint !== evidence.fingerprint) slot.ambiguous = true;
    const signature = slot.signature ?? await adapter.signature(state).catch(() => "");
    if (!this.current(slot)) return;
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
    if (!slot || !this.current(slot) || slot.agent !== event.agent || !sameModel(slot.model, event.model)) return;
    return slot;
  }

  /** Finish every ordinary attempt; consume authority only for confirmed quota. */
  finish(event: SessionRetry, exhausted: boolean): Dispatch | undefined {
    const slot = this.inspect(event);
    if (!slot || slot.finished) return;
    slot.finished = true;
    if (!exhausted || slot.ambiguous || slot.consumed || !slot.credentialID || !slot.binding || !slot.adapter) return;
    slot.consumed = true;
    return slot;
  }

  authorize(slot: Dispatch, credentialID: string): boolean {
    if (!this.current(slot) || slot.ambiguous) return false;
    slot.authorization = { credentialID, prepared: slot.kind === "compaction" };
    return true;
  }
  clear(sessionID: string, created = Infinity): void {
    const slot = this.slots.get(sessionID);
    if (slot && created >= slot.created) this.slots.delete(sessionID);
  }
  dispose(): void { this.slots.clear(); this.identities.clear(); }
  private stop(): never { throw new Error("opencode-account-rotate: continuation changed during recovery; submit again"); }
  private prune(): void {
    const now = Date.now();
    for (const [key, slot] of this.slots) if (now - slot.created > 30 * 60_000) this.slots.delete(key);
    for (const [key, identity] of this.identities) if (identity.until <= now) this.identities.delete(key);
    while (this.slots.size > 512) this.slots.delete(this.slots.keys().next().value!);
    while (this.identities.size > 256) this.identities.delete(this.identities.keys().next().value!);
  }
}
