import type { SessionRetry } from "@opencode/plugin/promise/session";
import type { QuotaVerdict } from "../../core/types.js";
export interface QuotaPolicy {
    /** Exceptional reviewed codes can survive imperfect native normalization. */
    explicitUnclassified?: boolean;
    exhaustion(error: SessionRetry["error"], body: Record<string, unknown> | undefined): boolean;
    nonExhaustion(error: SessionRetry["error"], body: Record<string, unknown> | undefined): boolean;
    reset(body: Record<string, unknown> | undefined): unknown;
}
export declare function classify(error: SessionRetry["error"], policy: QuotaPolicy, now?: number): QuotaVerdict;
