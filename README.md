# OpenCode Auto Provider

Rotates existing saved **OpenAI** accounts on confirmed usage/quota exhaustion using OpenCode's native account activation API. Targets stock OpenCode V2 **2.0.32+**, including Desktop.

- One rotation list across ChatGPT token-sharing, Codex browser, Codex headless, and saved API-key credentials. No sign-in-method grouping; no API key required.
- Ordinary throttling retains OpenCode's retry/backoff policy.
- HTTP, WebSocket, and WebSocket-to-HTTP fallback attribution.
- No credential copies, custom OAuth, proxy, database, polling service, request-body edits, or custom tool replay.
- Native selection is shared and persistent: switching affects other sessions and locations too.

## Build and install

```sh
npm install
npm run typecheck
npm run build
```

Add the built entrypoint to **global** `~/.config/opencode/opencode.jsonc` (merge with existing settings):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "file:///C:/Users/USER/DEVELOPMENT_SPACE/Experiments/auto-provider/dist/index.js",
  ],
}
```

Use your actual absolute path if you move the repository. Keep `dist/` and the installed dependencies available. Reload/restart OpenCode's backend after installation or rebuilding an unwatched local dependency. Desktop uses the backend's plugin configuration, not `cli.json`.

Sign in to multiple accounts using OpenCode's existing authentication UI. This plugin has no separate login or configuration. Installation does not itself switch accounts. No user configuration is edited by the build.

## Recovery behavior

1. Match explicit quota codes/messages, rather than assuming every 429 is quota exhaustion.
2. Attribute the failed dispatch using a hashed bearer/account-header identity. Auxiliary title/generate requests do not participate.
3. Cool down the sending credential until a recognized quota reset, or for five minutes if none is known.
4. Resolve and activate the next existing saved credential. OAuth refresh and persistence remain OpenCode's responsibility.
5. Await observable route, account-header, provider, model, and variant readiness for up to ten seconds per candidate. Skip unavailable candidates without changing the selected model or treating them as quota-exhausted.
6. Let OpenCode rebuild and retry the primary request within its existing retry allowance.

Rotation decisions are serialized within one plugin instance. A concurrent native selection is respected instead of advancing again. Exhausted accounts are not revisited within the same recovery chain, even if their fallback cooldown expires. Cooldowns and attribution are memory-only and reset when the plugin reloads. Logs contain fixed diagnostic messages, never tokens, account identifiers, prompts, or response bodies.

Saved credentials are deduplicated by credential ID only. Different sign-in methods for the same underlying account may have different allowances. Environment-variable connections cannot be activated and do not participate. Unknown/custom destinations are unmanaged. Saved credentials with unknown future authentication methods may be activated, but automatic continuation requires recognized authentication and route readiness.

## Compaction and other limits

**An in-progress compaction is prepared once in stock 2.0.32.** When activation changes its route, model settings, or compaction mechanism, the plugin stops that operation after switching accounts. Submit again to let OpenCode prepare against the new selection. It does not force Codex native compaction through the token-sharing endpoint.

For unchanged routes/settings, a compaction retry can update only its stale bearer/account-header pair after rechecking native selection and an account-neutral provider/model fingerprint. No body or opaque state is rewritten. Cross-account encrypted reasoning/native checkpoint portability is not guaranteed; if the provider rejects state, the plugin leaves that error to OpenCode rather than stripping context.

OpenCode owns transcript re-expansion for incompatible checkpoint provenance, output/tool replay safety, retry budgets, and mid-stream failure handling. Some errors after output begins never reach the retry hook, so uninterrupted recovery is not universal.

Public retry hooks lack request IDs, request kinds, and cancellation signals. The plugin correlates prepared model calls with dispatches, refuses ambiguous attribution, and observes terminal lifecycle events for cleanup/cancellation. State expires after thirty minutes and attribution maps are size-bounded. A failed lifecycle stream requires a reload for full lifecycle tracking. Other plugins that replace authentication after these hooks can invalidate attribution; register this plugin after authentication/transport-mutating plugins.

There is no public compare-and-swap activation or globally awaited provider-reload barrier. Local serialization and readiness checks cannot make switching atomic against manual changes, other locations, or other processes. Cancellation cannot undo activation already committed, and native credential resolution already in progress may finish after cancellation.

## Validation

Type checking, compilation, package contents, and module loading can be checked without consuming account quota. No test files or test suite are included.

Real-account Desktop acceptance remains required before relying on automatic continuation: quota-triggered primary retries across all sign-in methods, concurrent sessions/manual switches, ordinary rate limits, tools, compaction, encrypted state, WebSocket reuse/fallback, cancellation, and pool exhaustion. These scenarios have not been validated against live accounts.

Sources: [V2 plugin API](https://opencode.ai/v2/docs/build/plugins), [plugin configuration](https://opencode.ai/v2/docs/plugins), and the official [v2.0.32 source](https://github.com/anomalyco/opencode/tree/v2.0.32). Newer V2 versions are accepted without an exact-version gate; public API compatibility still needs verification on those versions.
