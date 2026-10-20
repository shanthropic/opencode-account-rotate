import type { SessionRetry } from "@opencode/plugin/promise/session";
import type { Context } from "./types.js";
import type { Accounts } from "./accounts.js";
import type { Dispatch, Dispatches } from "./dispatch.js";
/** Instance is integration-bound: shared across providers using that integration. */
export declare class Rotation {
    private ctx;
    private accounts;
    private dispatches;
    private signal;
    private coordinator;
    private cooldowns;
    private chains;
    private pending;
    constructor(ctx: Context, accounts: Accounts, dispatches: Dispatches, signal: AbortSignal);
    recover(event: SessionRetry, sent: Dispatch, until: number): Promise<void>;
    clear(sessionID: string, created?: number): void;
    dispose(): void;
    private run;
    private bindingReady;
    private waitReady;
    private resume;
    private check;
    private prune;
}
