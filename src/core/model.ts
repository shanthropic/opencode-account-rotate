import type { Model } from "@opencode/plugin";
import type { Binding, Context } from "./types.js";

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Native overlays merge objects recursively; arrays/scalars replace. */
export function merge(
  left: Record<string, unknown> | undefined,
  right: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const result = { ...left };
  for (const [key, value] of Object.entries(right ?? {})) {
    if (value === undefined) continue;
    result[key] = record(value) && record(result[key])
      ? merge(result[key], value)
      : value;
  }
  return result;
}

export function overlayHeaders(
  ...inputs: (Record<string, string> | undefined)[]
): Headers {
  const headers = new Headers();
  for (const input of inputs)
    for (const [key, value] of Object.entries(input ?? {})) headers.set(key, value);
  return headers;
}

export async function snapshot(ctx: Context, ref: Model.Ref) {
  const [providers, models] = await Promise.all([
    ctx.provider.list(), ctx.model.list(),
  ]);
  const provider = providers.data.find((p) => p.id === ref.providerID);
  // Public models already include provider defaults. Do not overlay them again.
  const model = models.data.find(
    (m) => m.providerID === ref.providerID && m.id === ref.id && m.enabled,
  );
  if (!provider || !model) return;
  const variant = ref.variant && ref.variant !== "default"
    ? model.variants.find((v) => v.id === ref.variant)
    : undefined;
  if (ref.variant && ref.variant !== "default" && !variant) return;
  const binding: Binding = {
    integrationID: provider.integrationID ?? provider.id,
    providerID: provider.id,
    package: model.package ?? provider.package,
    canonical: model.canonical ?? provider.canonical,
    model: { ...ref },
  };
  return {
    binding, provider, model,
    settings: merge(model.settings, variant?.settings),
    body: merge(model.body, variant?.body),
    headers: overlayHeaders(model.headers, variant?.headers),
    // Transport policy belongs to the provider, not variant/model settings.
    transport: provider.settings?.transport,
  };
}
export type Snapshot = NonNullable<Awaited<ReturnType<typeof snapshot>>>;

export function sameModel(a: Model.Ref, b: Model.Ref): boolean {
  return a.providerID === b.providerID && a.id === b.id && a.variant === b.variant;
}

export function sameBinding(a: Binding, b: Binding): boolean {
  return a.integrationID === b.integrationID && a.providerID === b.providerID &&
    a.package === b.package && a.canonical === b.canonical && sameModel(a.model, b.model);
}
