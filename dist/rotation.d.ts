import type { SessionRetry } from "@opencode/plugin/promise/session";
import { Accounts } from "./accounts.js";
import type { Context } from "./accounts.js";
import type { Dispatch } from "./dispatch.js";
export declare class Rotation {
    private ctx;
    private accounts;
    private signal;
    private queue;
    private cooldowns;
    private chains;
    private pending;
    constructor(ctx: Context, accounts: Accounts, signal: AbortSignal);
    recover(event: SessionRetry, sent: Dispatch, until: number): Promise<void>;
    clear(sessionID: string, created?: number): void;
    private run;
    private waitReady;
    private resume;
    private check;
}
