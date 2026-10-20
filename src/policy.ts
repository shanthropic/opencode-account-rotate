import type { SessionRetry } from "@opencode/plugin/promise/session";

const quotaCodes = new Set([
  "usage_limit_reached",
  "usage_limit_exceeded",
  "insufficient_quota",
  "quota_exceeded",
  "subscription_sharing_usage_limit_exceeded",
]);

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Only explicit quota evidence; a 429 or a generic rate-limit is not enough. */
export function quota(
  error: SessionRetry["error"],
  now = Date.now(),
): number | undefined {
  let body: Record<string, unknown> | undefined;
  try {
    const parsed: unknown = JSON.parse(error.response?.body ?? "null");
    const root = object(parsed);
    body = object(root?.error) ?? root;
  } catch {
    // Non-JSON bodies are deliberately not scanned for arbitrary substrings.
  }
  const confirmed =
    [body?.code, body?.type].some(
      (code) => typeof code === "string" && quotaCodes.has(code),
    ) ||
    /\b(?:you(?:'ve| have) (?:hit|reached) your usage limit|you exceeded your current quota)\b/i.test(
      error.message,
    );
  if (!confirmed) return;

  // These are provider quota reset fields, not Retry-After / throttle delays.
  const reset = body?.resets_at ?? body?.reset_at;
  let until: number | undefined;
  if (typeof reset === "number" && Number.isFinite(reset)) {
    until = reset < 10_000_000_000 ? reset * 1000 : reset;
  } else if (typeof reset === "string" && /^\d{4}-\d\d-\d\dT/.test(reset)) {
    until = Date.parse(reset);
  }
  return until !== undefined && Number.isFinite(until) && until > now
    ? until
    : now + 5 * 60_000;
}

export function diagnostic(message: string): void {
  // Callers supply fixed messages only. Never interpolate provider errors or IDs.
  console.info(`[auto-provider] ${message}`);
}
