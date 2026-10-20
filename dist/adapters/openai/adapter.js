import { StandardAdapter } from "../standard/adapter.js";
import { directToken } from "../standard/authentication.js";
import { accountHeader, route } from "./authentication.js";
import { destination } from "./endpoints.js";
import { quotaPolicy } from "./quota.js";
import { ready } from "./readiness.js";
export class OpenAIAdapter extends StandardAdapter {
    constructor() {
        super({
            id: "openai",
            providers: ["openai"],
            canonical: ["openai"],
            packages: ["@opencode/ai/providers/openai"],
            header: "authorization",
            scheme: "Bearer ",
            identityHeaders: ["chatgpt-account-id"],
            credential: (value) => !!route(value),
            destination,
            quota: quotaPolicy,
            configuration: ready,
        });
    }
    capability(account) {
        return route(account.value) && directToken(account.value)
            ? "continue"
            : "activate-only";
    }
    async inspect(account, url, headers, snapshot) {
        const result = await super.inspect(account, url, headers, snapshot);
        if (result)
            result.matches =
                result.matches &&
                    !!account &&
                    route(account.value) === result.route &&
                    (headers.get("chatgpt-account-id") ?? undefined) ===
                        (result.route === "codex" ? accountHeader(account.value) : undefined);
        return result;
    }
    ready(account, snapshot) {
        return super.ready(account, snapshot);
    }
    preparedCompatible(account, target) {
        return route(account.value) === target;
    }
    replacePrepared(account, target, headers) {
        const token = directToken(account.value);
        if (!token || route(account.value) !== target)
            return false;
        headers.set("authorization", `Bearer ${token}`);
        const id = target === "codex" ? accountHeader(account.value) : undefined;
        if (id)
            headers.set("chatgpt-account-id", id);
        else
            headers.delete("chatgpt-account-id");
        return true;
    }
}
