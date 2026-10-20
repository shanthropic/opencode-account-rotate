export function diagnostic(message) {
    // Fixed call-site strings only; never interpolate provider errors or IDs.
    console.info(`[opencode-account-rotate] ${message}`);
}
