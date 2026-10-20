function record(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
/** Native overlays merge objects recursively; arrays/scalars replace. */
export function merge(left, right) {
    const result = { ...left };
    for (const [key, value] of Object.entries(right ?? {})) {
        if (value === undefined)
            continue;
        result[key] =
            record(value) && record(result[key]) ? merge(result[key], value) : value;
    }
    return result;
}
export function overlayHeaders(...inputs) {
    const headers = new Headers();
    for (const input of inputs)
        for (const [key, value] of Object.entries(input ?? {}))
            headers.set(key, value);
    return headers;
}
export async function snapshot(ctx, ref) {
    const [providers, models] = await Promise.all([
        ctx.provider.list(),
        ctx.model.list(),
    ]);
    const provider = providers.data.find((p) => p.id === ref.providerID);
    // Public models already include provider defaults. Do not overlay them again.
    const model = models.data.find((m) => m.providerID === ref.providerID && m.id === ref.id && m.enabled);
    if (!provider || !model)
        return;
    const variant = ref.variant && ref.variant !== "default"
        ? model.variants.find((v) => v.id === ref.variant)
        : undefined;
    if (ref.variant && ref.variant !== "default" && !variant)
        return;
    const binding = {
        integrationID: provider.integrationID ?? provider.id,
        providerID: provider.id,
        package: model.package ?? provider.package,
        canonical: model.canonical ?? provider.canonical,
        model: { ...ref },
    };
    return {
        binding,
        provider,
        model,
        settings: merge(model.settings, variantSettings(variant?.settings)),
        body: merge(model.body, variant?.body),
        headers: overlayHeaders(model.headers, variant?.headers),
        // Transport policy belongs to the provider, not variant/model settings.
        transport: provider.settings?.transport,
    };
}
function variantSettings(input) {
    if (!input)
        return;
    return Object.fromEntries(Object.entries(input).filter(([key]) => !["chunkTimeout", "headerTimeout", "timeout", "transport"].includes(key)));
}
export function sameModel(a, b) {
    return (a.providerID === b.providerID && a.id === b.id && a.variant === b.variant);
}
export function sameBinding(a, b) {
    return (a.integrationID === b.integrationID &&
        a.providerID === b.providerID &&
        a.package === b.package &&
        a.canonical === b.canonical &&
        sameModel(a.model, b.model));
}
