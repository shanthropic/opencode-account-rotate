import type { Model } from "@opencode/plugin";
import type {
  SessionModelRequest,
  SessionRetry,
  SessionRequestKind,
} from "@opencode/plugin/promise/session";
import {
  Accounts,
  accountHeader,
  bearer,
  destination,
  hash,
} from "./accounts.js";
import type { Route } from "./accounts.js";

export interface Dispatch {
  sessionID: string;
  agent: string;
  model: Model.Ref;
  kind: SessionRequestKind;
  created: number;
  ambiguous: boolean;
  consumed: boolean;
  credentialID?: string;
  fingerprint?: string;
  preparedFingerprint?: string;
  route?: Route;
  signature?: string;
  replacement?: string;
}

/** No tokens or bodies are retained. HTTP fallback shares its prepared WS slot. */
export class Dispatches {
  private slots = new Map<string, Dispatch>();
  private identities = new Map<string, { id: string; until: number }>();

  constructor(private accounts: Accounts) {}

  begin(event: SessionModelRequest): void {
    if (event.kind !== "primary" && event.kind !== "compaction") return;
    this.prune();
    const previous = this.slots.get(event.sessionID);
    this.slots.set(event.sessionID, {
      sessionID: event.sessionID,
      agent: event.agent,
      model: event.model,
      kind: event.kind,
      created: Date.now(),
      ambiguous: !!previous && !previous.consumed,
      consumed: false,
    });
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
      Date.now() - slot.created > 30 * 60_000 ||
      slot.kind !== event.kind ||
      !sameModel(slot.model, event.model) ||
      slot.agent !== event.agent
    ) {
      if (slot) slot.ambiguous = true;
      return;
    }
    const route = destination(url);
    const authorization = headers.get("authorization");
    if (!route || !authorization?.startsWith("Bearer ")) {
      slot.ambiguous = true;
      return;
    }
    let fingerprint = await identity(
      authorization,
      headers.get("chatgpt-account-id"),
      route,
    );
    const active = await this.accounts.active().catch(() => undefined);
    if (this.slots.get(event.sessionID) !== slot) return;

    // Only an explicitly authorized same-route compaction retry may replace stale auth.
    // Its route, model settings and mechanism must still match the prepared request.
    if (slot.replacement && slot.kind === "compaction") {
      if (
        !active ||
        active.connection.id !== slot.replacement ||
        active.route !== route ||
        (fingerprint !== slot.preparedFingerprint &&
          fingerprint !== slot.fingerprint) ||
        !(await this.accounts.ready(active, slot.model)) ||
        (await this.accounts.signature(slot.model)) !== slot.signature
      ) {
        throw new Error(
          "auto-provider: prepared compaction changed during account recovery; run again",
        );
      }
      const token = bearer(active.value);
      if (!token)
        throw new Error(
          "auto-provider: activated credential cannot authenticate this compaction",
        );
      headers.set("authorization", `Bearer ${token}`);
      const accountID =
        route === "codex" ? accountHeader(active.value) : undefined;
      if (accountID) headers.set("chatgpt-account-id", accountID);
      else headers.delete("chatgpt-account-id");
      fingerprint = await identity(
        headers.get("authorization")!,
        accountID ?? null,
        route,
      );
    }

    if (
      active &&
      active.route === route &&
      bearer(active.value) &&
      headers.get("authorization") === `Bearer ${bearer(active.value)}` &&
      (headers.get("chatgpt-account-id") ?? undefined) ===
        (route === "codex" ? accountHeader(active.value) : undefined)
    ) {
      this.identities.set(fingerprint, {
        id: active.connection.id,
        until: Date.now() + 30 * 60_000,
      });
    }
    const known = this.identities.get(fingerprint);
    if (!known || known.until < Date.now()) {
      slot.ambiguous = true;
      return;
    }
    if (!slot.consumed && slot.fingerprint && slot.fingerprint !== fingerprint)
      slot.ambiguous = true;
    slot.consumed = false;
    slot.credentialID = known.id;
    slot.preparedFingerprint ??= fingerprint;
    slot.fingerprint = fingerprint;
    slot.route = route;
    slot.signature ??= await this.accounts
      .signature(event.model)
      .catch(() => "");
  }

  take(event: SessionRetry): Dispatch | undefined {
    const slot = this.slots.get(event.sessionID);
    if (
      !slot ||
      Date.now() - slot.created > 30 * 60_000 ||
      slot.ambiguous ||
      slot.consumed ||
      !slot.credentialID ||
      slot.agent !== event.agent ||
      !sameModel(slot.model, event.model)
    )
      return;
    slot.consumed = true;
    return slot;
  }

  clear(sessionID: string, created = Infinity): void {
    const slot = this.slots.get(sessionID);
    if (slot && created >= slot.created) this.slots.delete(sessionID);
  }

  dispose(): void {
    this.slots.clear();
    this.identities.clear();
  }

  private prune(): void {
    const now = Date.now();
    for (const [id, slot] of this.slots)
      if (now - slot.created > 30 * 60_000) this.slots.delete(id);
    for (const [key, value] of this.identities)
      if (value.until < now) this.identities.delete(key);
    // Bounded even when lifecycle events are unavailable.
    while (this.slots.size >= 512)
      this.slots.delete(this.slots.keys().next().value!);
    while (this.identities.size >= 256)
      this.identities.delete(this.identities.keys().next().value!);
  }
}

function sameModel(a: Model.Ref, b: Model.Ref): boolean {
  return (
    a.providerID === b.providerID && a.id === b.id && a.variant === b.variant
  );
}

function identity(
  authorization: string,
  accountID: string | null,
  route: Route,
): Promise<string> {
  return hash(JSON.stringify([authorization, accountID, route]));
}
