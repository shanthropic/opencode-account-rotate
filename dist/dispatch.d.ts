import type { Model } from "@opencode/plugin";
import type { SessionModelRequest, SessionRetry, SessionRequestKind } from "@opencode/plugin/promise/session";
import { Accounts } from "./accounts.js";
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
export declare class Dispatches {
    private accounts;
    private slots;
    private identities;
    constructor(accounts: Accounts);
    begin(event: SessionModelRequest): void;
    observe(event: Pick<SessionModelRequest, "sessionID" | "agent" | "model" | "kind">, url: string, headers: Headers): Promise<void>;
    take(event: SessionRetry): Dispatch | undefined;
    clear(sessionID: string, created?: number): void;
    dispose(): void;
    private prune;
}
