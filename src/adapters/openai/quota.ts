import type { QuotaPolicy } from "../standard/quota.js";

const codes = new Set([
  "usage_limit_reached",
  "usage_limit_exceeded",
  "insufficient_quota",
  "quota_exceeded",
  "subscription_sharing_usage_limit_exceeded",
]);
export const quotaPolicy: QuotaPolicy = {
  nonExhaustion: (error, body) =>
    error.type === "provider.auth" ||
    [401, 402, 403].includes(error.status ?? 0) ||
    [body?.code, body?.type].some(
      (code) =>
        typeof code === "string" &&
        [
          "subscription_sharing_user_not_eligible",
          "subscription_sharing_unsupported_capability",
          "subscription_sharing_route_not_supported",
          "subscription_sharing_invalid_user",
          "chatpass_v2_scope_not_authorized",
          "chatpass_v2_invalid_authorization_context",
          "billing_not_active",
          "model_not_found",
          "permission_denied",
          "authentication_error",
          "invalid_api_key",
        ].includes(code),
    ) ||
    [error.message, body?.message].some(
      (message) =>
        typeof message === "string" &&
        /\b(?:package has expired|plan does not yet include|payment required|model (?:is )?not (?:available|supported))\b/i.test(
          message,
        ),
    ),
  exactExhaustion: (body) =>
    [body?.code, body?.type].some(
      (code) => typeof code === "string" && codes.has(code),
    ),
  exhaustion: (error, body) =>
    [error.message, body?.message].some(
      (message) =>
        typeof message === "string" &&
        /\b(?:you(?:'ve| have) (?:hit|reached) your usage limit|you exceeded your current quota)\b/i.test(
          message,
        ),
    ),
  reset: (body) => body?.resets_at ?? body?.reset_at,
};
