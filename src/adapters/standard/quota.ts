import type { SessionRetry } from "@opencode/plugin/promise/session";
import type { QuotaVerdict } from "../../core/types.js";

export interface QuotaPolicy {
  /** Only reviewed exact codes may override broad native normalization. */
  exactExhaustion(body: Record<string, unknown> | undefined): boolean;
  exhaustion(
    error: SessionRetry["error"],
    body: Record<string, unknown> | undefined,
  ): boolean;
  nonExhaustion(
    error: SessionRetry["error"],
    body: Record<string, unknown> | undefined,
  ): boolean;
  reset(body: Record<string, unknown> | undefined): unknown;
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function classify(
  error: SessionRetry["error"],
  policy: QuotaPolicy,
  now = Date.now(),
): QuotaVerdict {
  const bodies: Array<Record<string, unknown> | undefined> = [];
  try {
    const root = object(JSON.parse(error.response?.body ?? "null"));
    for (const body of [
      root,
      object(root?.error),
      object(object(root?.response)?.error),
    ])
      if (body) bodies.push(body);
  } catch {
    /* Arbitrary response text is not exhaustion evidence. */
  }
  if (!bodies.length) bodies.push(undefined);
  // Contradictory outer evidence must not be hidden by a nested quota code.
  if (bodies.some((body) => policy.nonExhaustion(error, body)))
    return { kind: "not-exhausted" };
  let body = bodies.find((body) => policy.exactExhaustion(body));
  if (!body) {
    if (error.type === "provider.rate-limit") return { kind: "not-exhausted" };
    if (error.type !== "provider.quota") return { kind: "unknown" };
    // Generic native quota plus a reviewed message is narrower than an exact code.
    const index = bodies.findIndex((body) => policy.exhaustion(error, body));
    if (index < 0) return { kind: "unknown" };
    body = bodies[index];
  }
  const reset = policy.reset(body);
  let until: number | undefined;
  if (typeof reset === "number" && Number.isFinite(reset))
    until = reset < 10_000_000_000 ? reset * 1000 : reset;
  else if (typeof reset === "string" && /^\d{4}-\d\d-\d\dT/.test(reset))
    until = Date.parse(reset);
  return {
    kind: "exhausted",
    until:
      until !== undefined && Number.isFinite(until) && until > now
        ? until
        : now + 5 * 60_000,
  };
}
