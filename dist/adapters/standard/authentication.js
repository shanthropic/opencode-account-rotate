export function directToken(value) {
    return value.type === "key"
        ? value.key
        : value.type === "oauth"
            ? value.access
            : undefined;
}
export async function hash(value) {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
export function trustedURL(input) {
    try {
        const url = new URL(input);
        if (url.username || url.password || url.port || url.hash || url.search)
            return;
        if (url.protocol !== "https:" && url.protocol !== "wss:")
            return;
        return url;
    }
    catch {
        return;
    }
}
export async function fingerprint(namespace, route, headers, names) {
    return hash(JSON.stringify([
        namespace,
        route,
        names.map((name) => [name.toLowerCase(), headers.get(name)]),
    ]));
}
/** Account-neutral comparison, never retained as raw settings or credentials. */
export async function signature(snapshot) {
    return hash(JSON.stringify(snapshot));
}
