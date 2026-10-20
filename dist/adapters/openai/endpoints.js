import { trustedURL } from "../standard/authentication.js";
export function destination(input) {
    const url = trustedURL(input);
    if (!url)
        return;
    if (url.hostname === "chatgpt.com" &&
        /^\/backend-api\/codex\/responses(?:\/compact)?$/.test(url.pathname))
        return "codex";
    if (url.hostname === "api.openai.com" &&
        /^\/v1\/(?:responses(?:\/compact)?|chat\/completions)$/.test(url.pathname))
        return "api";
}
export function baseRoute(input) {
    return typeof input === "string"
        ? destination(`${input.replace(/\/$/, "")}/responses`)
        : undefined;
}
