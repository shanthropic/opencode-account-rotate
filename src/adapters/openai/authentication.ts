import type { Credential } from "@opencode/plugin";
import type { Route } from "./endpoints.js";

export function route(value: Credential.Value): Route | undefined {
  if (value.type === "key") return "api";
  if (value.type !== "oauth") return;
  if (value.methodID === "chatgpt-token-sharing") return "api";
  if (value.methodID === "chatgpt-browser" || value.methodID === "chatgpt-headless") return "codex";
}
export function accountHeader(value: Credential.Value): string | undefined {
  const id = value.metadata?.accountID;
  return typeof id === "string" ? id : undefined;
}
