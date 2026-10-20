import type { Account } from "../../core/types.js";
import type { Snapshot } from "../../core/model.js";
import { StandardAdapter } from "../standard/adapter.js";
import { directToken } from "../standard/authentication.js";
import { accountHeader, route } from "./authentication.js";
import { destination } from "./endpoints.js";
import { quotaPolicy } from "./quota.js";
import { ready } from "./readiness.js";

export class OpenAIAdapter extends StandardAdapter {
  constructor() {
    super({
      id: "openai", providers: ["openai"],
      packages: ["@opencode/ai/providers/openai"],
      header: "authorization", scheme: "Bearer ", identityHeaders: ["chatgpt-account-id"],
      credential: (value) => !!route(value), destination, quota: quotaPolicy,
    });
  }
  override capability(account: Account) {
    return route(account.value) && directToken(account.value) ? "continue" as const : "activate-only" as const;
  }
  override async inspect(account: Account | undefined, url: string, headers: Headers, snapshot: Snapshot) {
    const result = await super.inspect(account, url, headers, snapshot);
    if (result) result.matches = result.matches && !!account && route(account.value) === result.route &&
      (headers.get("chatgpt-account-id") ?? undefined) === (result.route === "codex" ? accountHeader(account.value) : undefined);
    return result;
  }
  override ready(account: Account, snapshot: Snapshot): boolean {
    return this.matches(snapshot) && ready(account, snapshot);
  }
  replacePrepared(account: Account, target: string, headers: Headers): boolean {
    const token = directToken(account.value);
    if (!token || route(account.value) !== target) return false;
    headers.set("authorization", `Bearer ${token}`);
    const id = target === "codex" ? accountHeader(account.value) : undefined;
    if (id) headers.set("chatgpt-account-id", id);
    else headers.delete("chatgpt-account-id");
    return true;
  }
}
