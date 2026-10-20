import type { Model } from "@opencode/plugin";
import type { Binding, Context } from "./types.js";
/** Native overlays merge objects recursively; arrays/scalars replace. */
export declare function merge(left: Record<string, unknown> | undefined, right: Record<string, unknown> | undefined): Record<string, unknown>;
export declare function overlayHeaders(...inputs: (Record<string, string> | undefined)[]): Headers;
export declare function snapshot(ctx: Context, ref: Model.Ref): Promise<{
    binding: Binding;
    provider: import("@opencode/client").ProviderInfo;
    model: import("@opencode/client").ModelInfo;
    settings: Record<string, unknown>;
    body: Record<string, unknown>;
    headers: Headers;
    transport: import("@opencode/client").ProviderTransport | undefined;
} | undefined>;
export type Snapshot = NonNullable<Awaited<ReturnType<typeof snapshot>>>;
export declare function sameModel(a: Model.Ref, b: Model.Ref): boolean;
export declare function sameBinding(a: Binding, b: Binding): boolean;
