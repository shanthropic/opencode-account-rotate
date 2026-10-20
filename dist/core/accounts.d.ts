import type { Account, Context, Saved } from "./types.js";
/** One native inventory/order per integration, never per authentication method. */
export declare class Accounts {
    private ctx;
    readonly integrationID: string;
    private resolving;
    private order;
    constructor(ctx: Context, integrationID: string);
    list(): Promise<Saved[]>;
    active(): Promise<Account | undefined>;
    activeID(): Promise<string | undefined>;
    resolve(connection: Saved): Promise<Account | undefined>;
    dispose(): void;
}
