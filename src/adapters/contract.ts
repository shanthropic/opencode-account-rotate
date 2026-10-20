import type { SessionRetry } from "@opencode/plugin/promise/session";
import type { Snapshot } from "../core/model.js";
import type { Account, Capability, QuotaVerdict } from "../core/types.js";

export interface Authentication {
  route: string;
  fingerprint: string;
  matches: boolean;
}

export interface Adapter {
  readonly id: string;
  matches(snapshot: Snapshot): boolean;
  capability(account: Account): Capability;
  quota(error: SessionRetry["error"]): QuotaVerdict;
  inspect(account: Account | undefined, url: string, headers: Headers, snapshot: Snapshot): Promise<Authentication | undefined>;
  ready(account: Account, snapshot: Snapshot): boolean;
  signature(snapshot: Snapshot): Promise<string>;
  /** Absent for standard profiles: prepared authentication must not be replaced. */
  replacePrepared?(account: Account, route: string, headers: Headers): boolean;
}
