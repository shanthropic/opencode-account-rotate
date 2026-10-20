import type { Adapter } from "../contract.js";
import type { Account, Capability } from "../../core/types.js";
import type { Snapshot } from "../../core/model.js";
import type { Profile } from "./profiles.js";
export declare class StandardAdapter implements Adapter {
    protected profile: Profile;
    readonly id: string;
    constructor(profile: Profile);
    matches(snapshot: Snapshot): boolean;
    capability(account: Account): Capability;
    quota(error: Parameters<Adapter["quota"]>[0]): import("../../core/types.js").QuotaVerdict;
    inspect(account: Account | undefined, url: string, headers: Headers, snapshot: Snapshot): Promise<{
        route: string;
        fingerprint: string;
        matches: boolean;
    } | undefined>;
    ready(account: Account, snapshot: Snapshot): boolean;
    signature(snapshot: Snapshot): Promise<string>;
}
