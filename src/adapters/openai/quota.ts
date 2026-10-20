import type { QuotaPolicy } from "../standard/quota.js";

const codes = new Set([
  "usage_limit_reached", "usage_limit_exceeded", "insufficient_quota",
  "quota_exceeded", "subscription_sharing_usage_limit_exceeded",
]);
export const quotaPolicy: QuotaPolicy = {
  nonExhaustion: (error) => /\b(?:package has expired|plan does not yet include|payment required|model (?:is )?not (?:available|supported))\b/i.test(error.message),
  exhaustion: (error, body) => [body?.code, body?.type].some((code) => typeof code === "string" && codes.has(code)) ||
    /\b(?:you(?:'ve| have) (?:hit|reached) your usage limit|you exceeded your current quota)\b/i.test(error.message),
  reset: (body) => body?.resets_at ?? body?.reset_at,
};
