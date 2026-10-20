import { Accounts } from "./accounts.js";
import { diagnostic } from "./policy.js";
export class Rotation {
    ctx;
    accounts;
    signal;
    queue = Promise.resolve();
    cooldowns = new Map();
    chains = new Map();
    pending = new Set();
    constructor(ctx, accounts, signal) {
        this.ctx = ctx;
        this.accounts = accounts;
        this.signal = signal;
    }
    recover(event, sent, until) {
        const operation = {
            sessionID: event.sessionID,
            created: sent.created,
            controller: new AbortController(),
        };
        this.pending.add(operation);
        const signal = AbortSignal.any([this.signal, operation.controller.signal]);
        const next = this.queue
            .then(() => this.run(event, sent, until, signal))
            .finally(() => this.pending.delete(operation));
        this.queue = next.catch(() => { });
        return next;
    }
    clear(sessionID, created = Infinity) {
        for (const operation of this.pending) {
            if (operation.sessionID === sessionID && created >= operation.created)
                operation.controller.abort();
        }
        const chain = this.chains.get(sessionID);
        if (chain && created >= chain.created)
            this.chains.delete(sessionID);
    }
    async run(event, sent, until, signal) {
        this.check(signal);
        // Once a quota failure is attributed, uncertainty must not retry the exhausted token.
        event.decision = { retry: false };
        const failed = sent.credentialID;
        this.cooldowns.set(failed, Math.max(this.cooldowns.get(failed) ?? 0, until));
        const now = Date.now();
        for (const [id, expiry] of this.cooldowns)
            if (expiry <= now)
                this.cooldowns.delete(id);
        for (const [id, chain] of this.chains)
            if (now - chain.created > 30 * 60_000)
                this.chains.delete(id);
        const chain = this.chains.get(event.sessionID) ?? {
            tried: new Set(),
            created: sent.created,
        };
        this.chains.set(event.sessionID, chain);
        chain.tried.add(failed);
        const selected = await this.accounts.active();
        this.check(signal);
        if (!selected) {
            diagnostic("Native selection is not a saved account; automatic recovery stopped.");
            return;
        }
        if (selected.connection.id !== failed) {
            // A concurrent switch wins. Do not advance twice for the same exhausted sender.
            if (!this.cooldowns.has(selected.connection.id) &&
                !chain.tried.has(selected.connection.id)) {
                await this.resume(event, sent, selected, signal);
            }
            return;
        }
        let entries = await this.accounts.list();
        let expected = failed;
        const seen = new Set();
        // Refresh once before declaring exhaustion, so newly saved accounts can join.
        for (let pass = 0; pass < 2; pass++) {
            const offset = entries.findIndex((entry) => entry.id === failed);
            const ordered = [
                ...entries.slice(offset + 1),
                ...entries.slice(0, offset + 1),
            ];
            for (const connection of ordered) {
                if (seen.has(connection.id) ||
                    chain.tried.has(connection.id) ||
                    this.cooldowns.has(connection.id))
                    continue;
                seen.add(connection.id);
                let candidate;
                try {
                    candidate = await this.accounts.resolve(connection);
                }
                catch {
                    diagnostic("A saved credential could not be resolved; trying the next account.");
                }
                this.check(signal);
                if (!candidate)
                    continue;
                if ((await this.accounts.activeID()) !== expected) {
                    diagnostic("Native account selection changed during recovery; automatic activation stopped.");
                    return;
                }
                this.check(signal);
                // No sign-in-method grouping: every resolved saved credential is eligible.
                await this.ctx.credential.activate({ credentialID: connection.id });
                this.check(signal);
                expected = connection.id;
                chain.tried.add(connection.id);
                diagnostic("Activated another saved OpenAI account.");
                const status = await this.waitReady(candidate, event, signal);
                if (status === "changed")
                    return;
                if (status === "ready") {
                    await this.resume(event, sent, candidate, signal);
                    return;
                }
                // Missing model/variant or an unready provider is not quota exhaustion.
                // Keep moving through the same provider without changing the requested model.
                diagnostic("Activated account did not become ready for the selected model; trying the next account.");
            }
            entries = await this.accounts.list();
        }
        diagnostic("No usable saved OpenAI accounts remain; quota retries stopped.");
    }
    async waitReady(account, event, signal) {
        const deadline = Date.now() + 10_000;
        do {
            this.check(signal);
            if ((await this.accounts.activeID()) !== account.connection.id) {
                diagnostic("Native account selection changed during recovery; automatic recovery stopped.");
                return "changed";
            }
            if (await this.accounts.ready(account, event.model))
                return "ready";
            await pause(100, signal);
        } while (Date.now() < deadline);
        return "timeout";
    }
    async resume(event, sent, account, signal) {
        if ((await this.waitReady(account, event, signal)) !== "ready")
            return;
        this.check(signal);
        if (sent.kind === "compaction") {
            if (sent.route !== account.route ||
                !sent.signature ||
                sent.signature !== (await this.accounts.signature(event.model))) {
                diagnostic("Account switched, but prepared compaction needs a fresh run. Submit again to continue.");
                return;
            }
            sent.replacement = account.connection.id;
        }
        if ((await this.accounts.activeID()) !== account.connection.id)
            return;
        this.check(signal);
        // The core retains ownership of its retry allowance and pre-output replay rules.
        event.decision = { retry: true, delay: 0 };
    }
    check(signal) {
        if (signal.aborted)
            throw new Error("opencode-account-rotate recovery cancelled");
    }
}
function pause(ms, signal) {
    return new Promise((resolve, reject) => {
        if (signal.aborted)
            return reject(new Error("opencode-account-rotate unloaded"));
        const abort = () => {
            clearTimeout(timer);
            reject(new Error("opencode-account-rotate unloaded"));
        };
        const timer = setTimeout(() => {
            signal.removeEventListener("abort", abort);
            resolve();
        }, ms);
        signal.addEventListener("abort", abort, { once: true });
    });
}
