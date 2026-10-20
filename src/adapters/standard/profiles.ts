import type { Credential } from "@opencode/plugin";
import type { QuotaPolicy } from "./quota.js";
import type { Snapshot } from "../../core/model.js";
import type { Account } from "../../core/types.js";

export interface Profile {
  id: string;
  /** Exact reviewed entrypoints; SDK transports require their own review. */
  packages: readonly string[];
  providers: readonly string[];
  canonical: readonly string[];
  header: string;
  scheme: string;
  identityHeaders: readonly string[];
  credential(value: Credential.Value): boolean;
  destination(url: string): string | undefined;
  configuration(account: Account, snapshot: Snapshot): boolean;
  quota: QuotaPolicy;
}

// Deliberately empty: adding a provider requires review, not protocol inference.
export const profiles: readonly Profile[] = [];
