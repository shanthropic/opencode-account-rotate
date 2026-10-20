import type { Credential, Model, Plugin } from "@opencode/plugin";

export type Context = Plugin.Context;
export type Saved = Extract<
  Awaited<ReturnType<Context["integration"]["connection"]["active"]>>,
  { type: "credential" }
>;
export interface Account {
  connection: Saved;
  value: Credential.Value;
}
export interface Binding {
  integrationID: string;
  providerID: string;
  package: string;
  canonical?: string;
  model: Model.Ref;
}
export type Capability = "continue" | "activate-only" | "unsupported";
export type QuotaVerdict =
  | { kind: "exhausted"; until: number }
  | { kind: "not-exhausted" }
  | { kind: "unknown" };
