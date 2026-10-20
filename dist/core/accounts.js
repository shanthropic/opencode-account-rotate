/** One native inventory/order per integration, never per authentication method. */
export class Accounts {
    ctx;
    integrationID;
    resolving = new Map();
    order = [];
    constructor(ctx, integrationID) {
        this.ctx = ctx;
        this.integrationID = integrationID;
    }
    async list() {
        const result = await this.ctx.integration.get({
            integrationID: this.integrationID,
        });
        const entries = result.data.connections.filter((c) => c.type === "credential");
        const byID = new Map(entries.map((c) => [c.id, c]));
        this.order = this.order.filter((id) => byID.has(id));
        for (const id of byID.keys())
            if (!this.order.includes(id))
                this.order.push(id);
        // Do not silently truncate native inventories: decline unreasonable sizes.
        if (this.order.length > 1024) {
            this.order = [];
            throw new Error("Saved account inventory exceeds recovery capacity");
        }
        return this.order.flatMap((id) => {
            const entry = byID.get(id);
            return entry ? [entry] : [];
        });
    }
    async active() {
        const connection = await this.ctx.integration.connection.active(this.integrationID);
        return connection?.type === "credential"
            ? this.resolve(connection)
            : undefined;
    }
    async activeID() {
        const connection = await this.ctx.integration.connection.active(this.integrationID);
        return connection?.type === "credential" ? connection.id : undefined;
    }
    resolve(connection) {
        const existing = this.resolving.get(connection.id);
        if (existing)
            return existing;
        if (this.resolving.size >= 64)
            return Promise.resolve(undefined);
        const pending = this.ctx.integration.connection
            .resolve(connection)
            .then((value) => (value ? { connection, value } : undefined))
            .finally(() => this.resolving.delete(connection.id));
        this.resolving.set(connection.id, pending);
        return pending;
    }
    dispose() {
        this.order = [];
        this.resolving.clear();
    }
}
