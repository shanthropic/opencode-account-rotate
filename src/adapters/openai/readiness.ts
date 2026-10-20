import type { Account } from "../../core/types.js";
import type { Snapshot } from "../../core/model.js";
import { accountHeader, route } from "./authentication.js";
import { baseRoute } from "./endpoints.js";

export function ready(account: Account, snapshot: Snapshot): boolean {
  const target = route(account.value);
  if (
    !target ||
    baseRoute(snapshot.settings.baseURL ?? "https://api.openai.com/v1") !==
      target
  )
    return false;
  const compaction = snapshot.settings.compaction as
    { type?: unknown } | undefined;
  if (
    account.value.type === "oauth" &&
    account.value.methodID === "chatgpt-token-sharing" &&
    (snapshot.transport !== "http" || compaction?.type !== "summary")
  )
    return false;
  const id = snapshot.headers.get("chatgpt-account-id") ?? undefined;
  return target === "codex"
    ? id === accountHeader(account.value)
    : id === undefined;
}
