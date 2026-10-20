import type { SessionRetry } from "@opencode/plugin/promise/session";
/** Only explicit quota evidence; a 429 or a generic rate-limit is not enough. */
export declare function quota(error: SessionRetry["error"], now?: number): number | undefined;
export declare function diagnostic(message: string): void;
