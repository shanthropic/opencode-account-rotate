import { resolveAdapter } from "../adapters/registry.js";
import { Accounts } from "./accounts.js";
import { sameBinding, sameModel, snapshot } from "./model.js";
/** Tokens/bodies never retained. WS and HTTP fallback share one preparation. */
export class Dispatches {
    ctx;
    accounts;
    slots = new Map();
    identities = new Map();
    generation = 0;
    constructor(ctx, accounts) {
        this.ctx = ctx;
        this.accounts = accounts;
    }
    async begin(event) {
        if (event.kind !== "primary" && event.kind !== "compaction")
            return;
        this.prune();
        const previous = this.slots.get(event.sessionID);
        const follows = previous?.finished &&
            previous.kind === event.kind &&
            sameModel(previous.model, event.model) &&
            previous.agent === event.agent;
        if (previous && !previous.finished)
            previous.ambiguous = true;
        const slot = {
            sessionID: event.sessionID,
            agent: event.agent,
            model: { ...event.model },
            kind: event.kind,
            created: Date.now(),
            generation: ++this.generation,
            chainID: follows ? previous.chainID : this.generation,
            ambiguous: !!previous && !previous.finished,
            finished: false,
            consumed: false,
            authorization: follows ? previous.authorization : undefined,
        };
        this.slots.set(event.sessionID, slot);
        this.prune();
        if (previous?.authorization && !follows)
            this.stop();
        const state = await snapshot(this.ctx, slot.model);
        if (!this.ensureCurrent(slot))
            return;
        if (state) {
            slot.binding = state.binding;
            slot.adapter = resolveAdapter(state);
        }
        if (slot.authorization &&
            (!state ||
                !slot.adapter ||
                !previous?.binding ||
                !sameBinding(previous.binding, state.binding)))
            this.stop();
    }
    current(slot) {
        return (this.slots.get(slot.sessionID) === slot &&
            Date.now() - slot.created <= 30 * 60_000);
    }
    async observe(event, url, headers) {
        if (event.kind !== "primary" && event.kind !== "compaction")
            return;
        const slot = this.slots.get(event.sessionID);
        if (!slot ||
            !this.current(slot) ||
            slot.kind !== event.kind ||
            !sameModel(slot.model, event.model) ||
            slot.agent !== event.agent) {
            if (slot) {
                slot.ambiguous = true;
                if (slot.authorization)
                    this.stop();
            }
            return;
        }
        const adapter = slot.adapter;
        const binding = slot.binding;
        const state = await snapshot(this.ctx, slot.model);
        if (!this.ensureCurrent(slot))
            return;
        if (!adapter ||
            !binding ||
            !state ||
            !sameBinding(binding, state.binding) ||
            resolveAdapter(state)?.id !== adapter.id) {
            slot.ambiguous = true;
            if (slot.authorization)
                this.stop();
            return;
        }
        const accounts = this.accounts(binding.integrationID);
        const active = await accounts.active().catch(() => undefined);
        let evidence = await adapter.inspect(active, url, headers, state);
        if (!this.ensureCurrent(slot))
            return;
        if (slot.authorization) {
            const expected = slot.authorization;
            if (slot.ambiguous ||
                !evidence ||
                !active ||
                active.connection.id !== expected.credentialID ||
                !adapter.ready(active, state) ||
                (await accounts.activeID()) !== expected.credentialID ||
                !this.current(slot))
                this.stop();
            if (expected.prepared) {
                if (!adapter.replacePrepared ||
                    evidence.route !== slot.route ||
                    !slot.signature ||
                    (await adapter.signature(state)) !== slot.signature ||
                    (evidence.fingerprint !== slot.preparedFingerprint &&
                        evidence.fingerprint !== slot.fingerprint))
                    this.stop();
                if (!this.current(slot) ||
                    (await accounts.activeID()) !== expected.credentialID)
                    this.stop();
                if (!adapter.replacePrepared(active, evidence.route, headers))
                    this.stop();
                evidence = await adapter.inspect(active, url, headers, state);
            }
            if (!evidence?.matches || !this.current(slot))
                this.stop();
        }
        if (!evidence) {
            slot.ambiguous = true;
            return;
        }
        if (evidence.matches && active) {
            const known = this.identities.get(evidence.fingerprint);
            // A collision is sticky until expiry; never overwrite association authority.
            this.identities.set(evidence.fingerprint, {
                id: known && known.until > Date.now() && known.id !== active.connection.id
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
            if (slot.authorization)
                this.stop();
            return;
        }
        if (!slot.finished &&
            slot.fingerprint &&
            slot.fingerprint !== evidence.fingerprint)
            slot.ambiguous = true;
        const signature = slot.signature ?? (await adapter.signature(state).catch(() => ""));
        if (!this.ensureCurrent(slot))
            return;
        slot.finished = false;
        slot.consumed = false;
        slot.credentialID = known.id;
        slot.preparedFingerprint ??= evidence.fingerprint;
        slot.fingerprint = evidence.fingerprint;
        slot.route = evidence.route;
        slot.signature = signature;
        this.prune();
    }
    inspect(event) {
        const slot = this.slots.get(event.sessionID);
        if (!slot ||
            !this.current(slot) ||
            slot.agent !== event.agent ||
            !sameModel(slot.model, event.model))
            return;
        return slot;
    }
    /** Finish every ordinary attempt; consume authority only for confirmed quota. */
    finish(event, exhausted) {
        const slot = this.inspect(event);
        if (!slot || slot.finished)
            return;
        slot.finished = true;
        const identity = slot.fingerprint
            ? this.identities.get(slot.fingerprint)
            : undefined;
        if (!exhausted ||
            slot.ambiguous ||
            slot.consumed ||
            !slot.credentialID ||
            identity?.id !== slot.credentialID ||
            identity.until <= Date.now() ||
            !slot.binding ||
            !slot.adapter)
            return;
        slot.consumed = true;
        return slot;
    }
    authorize(slot, credentialID) {
        if (!this.current(slot) || slot.ambiguous)
            return false;
        slot.authorization = { credentialID, prepared: slot.kind === "compaction" };
        return true;
    }
    clear(sessionID, created = Infinity) {
        const slot = this.slots.get(sessionID);
        if (slot && created >= slot.created)
            this.slots.delete(sessionID);
    }
    dispose() {
        this.slots.clear();
        this.identities.clear();
    }
    stop() {
        throw new Error("opencode-account-rotate: continuation changed during recovery; submit again");
    }
    ensureCurrent(slot) {
        const current = this.current(slot);
        if (!current && slot.authorization)
            this.stop();
        return current;
    }
    prune() {
        const now = Date.now();
        for (const [key, slot] of this.slots)
            if (now - slot.created > 30 * 60_000)
                this.slots.delete(key);
        for (const [key, identity] of this.identities)
            if (identity.until <= now)
                this.identities.delete(key);
        while (this.slots.size > 512)
            this.slots.delete(this.slots.keys().next().value);
        while (this.identities.size > 256)
            this.identities.delete(this.identities.keys().next().value);
    }
}
