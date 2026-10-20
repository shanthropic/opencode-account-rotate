import type { SessionRetry } from "@opencode/plugin/promise/session";
import type { QuotaVerdict } from "../../core/types.js";

export interface QuotaPolicy {
  /** Exceptional reviewed codes can survive imperfect native normalization. */
  explicitUnclassified?: boolean;
  exhaustion(error: SessionRetry["error"], body: Record<string, unknown> | undefined): boolean;
  nonExhaustion(error: SessionRetry["error"], body: Record<string, unknown> | undefined): boolean;
  reset(body: Record<string, unknown> | undefined): unknown;
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

export function classify(error: SessionRetry["error"], policy: QuotaPolicy, now = Date.now()): QuotaVerdict {
  let body: Record<string, unknown> | undefined;
  try {
    const root = object(JSON.parse(error.response?.body ?? "null"));
    body = object(root?.error) ?? root;
  } catch { /* Arbitrary response text is not exhaustion evidence. */ }
  if (policy.nonExhaustion(error, body)) return { kind: "not-exhausted" };
  if (error.type === "provider.rate-limit") return { kind: "not-exhausted" };
  if (error.type !== "provider.quota" && !policy.explicitUnclassified) return { kind: "unknown" };
  // Native provider.quota is evidence, not permission: a reviewed rule must confirm.
  if (!policy.exhaustion(error, body)) return { kind: "unknown" };
  const reset = policy.reset(body);
  let until: number | undefined;
  if (typeof reset === "number" && Number.isFinite(reset))
    until = reset < 10_000_000_000 ? reset * 1000 : reset;
  else if (typeof reset === "string" && /^\d{4}-\d\d-\d\dT/.test(reset))
    until = Date.parse(reset);
  return { kind: "exhausted", until: until !== undefined && Number.isFinite(until) && until > now ? until : now + 5 * 60_000 };
}
