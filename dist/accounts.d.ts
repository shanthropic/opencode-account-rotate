import type { Credential, Model, Plugin } from "@opencode/plugin";
export type Context = Plugin.Context;
export type Saved = Extract<Awaited<ReturnType<Context["integration"]["connection"]["active"]>>, {
    type: "credential";
}>;
export type Route = "codex" | "api";
export interface Account {
    connection: Saved;
    value: Credential.Value;
    route?: Route;
}
export declare function route(value: Credential.Value): Route | undefined;
export declare function bearer(value: Credential.Value): string | undefined;
export declare function accountHeader(value: Credential.Value): string | undefined;
/** Strict endpoint boundaries; custom routes are never authenticated by this plugin. */
export declare function destination(input: string): Route | undefined;
export declare class Accounts {
    private ctx;
    private resolving;
    private order;
    constructor(ctx: Context);
    list(): Promise<Saved[]>;
    active(): Promise<Account | undefined>;
    activeID(): Promise<string | undefined>;
    resolve(connection: Saved): Promise<Account | undefined>;
    /** Reads available models, not provider.get()'s possibly inactive definition. */
    ready(account: Account, ref: Model.Ref): Promise<boolean>;
    /** Account-neutral route/model fingerprint for prepared compaction reuse. */
    signature(ref: Model.Ref): Promise<string>;
}
export declare function hash(value: string): Promise<string>;
