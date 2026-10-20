import type { Model } from "@opencode/plugin";
import type { SessionModelRequest, SessionRequestKind, SessionRetry } from "@opencode/plugin/promise/session";
import type { Adapter } from "../adapters/contract.js";
import { Accounts } from "./accounts.js";
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
    authorization?: {
        credentialID: string;
        prepared: boolean;
    };
}
/** Tokens/bodies never retained. WS and HTTP fallback share one preparation. */
export declare class Dispatches {
    private ctx;
    private accounts;
    private slots;
    private identities;
    private generation;
    constructor(ctx: Context, accounts: (integrationID: string) => Accounts);
    begin(event: SessionModelRequest): Promise<void>;
    current(slot: Dispatch): boolean;
    observe(event: Pick<SessionModelRequest, "sessionID" | "agent" | "model" | "kind">, url: string, headers: Headers): Promise<void>;
    inspect(event: SessionRetry): Dispatch | undefined;
    /** Finish every ordinary attempt; consume authority only for confirmed quota. */
    finish(event: SessionRetry, exhausted: boolean): Dispatch | undefined;
    authorize(slot: Dispatch, credentialID: string): boolean;
    clear(sessionID: string, created?: number): void;
    dispose(): void;
    private stop;
    private ensureCurrent;
    private prune;
}
