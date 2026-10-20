import type { Credential } from "@opencode/plugin";
export declare function directToken(value: Credential.Value): string | undefined;
export declare function hash(value: string): Promise<string>;
export declare function trustedURL(input: string): URL | undefined;
export declare function fingerprint(namespace: string, route: string, headers: Headers, names: readonly string[]): Promise<string>;
/** Account-neutral comparison, never retained as raw settings or credentials. */
export declare function signature(snapshot: unknown): Promise<string>;
