import type { Account } from "../../core/types.js";
import type { Snapshot } from "../../core/model.js";
import { StandardAdapter } from "../standard/adapter.js";
export declare class OpenAIAdapter extends StandardAdapter {
    constructor();
    capability(account: Account): "continue" | "activate-only";
    inspect(account: Account | undefined, url: string, headers: Headers, snapshot: Snapshot): Promise<{
        route: string;
        fingerprint: string;
        matches: boolean;
    } | undefined>;
    ready(account: Account, snapshot: Snapshot): boolean;
    preparedCompatible(account: Account, target: string): boolean;
    replacePrepared(account: Account, target: string, headers: Headers): boolean;
}
