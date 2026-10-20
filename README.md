# OpenCode Account Rotate

Rotates existing saved **OpenAI** accounts on confirmed quota exhaustion through OpenCode V2's native activation API. Requires **OpenCode 2.0.32+**. [MIT licensed](LICENSE).

- Uses your existing OpenCode sign-ins—no separate login, credential copies, or API key required.
- Keeps your selected provider, model, and variant unchanged.
- Leaves ordinary rate limits, credential refresh, tools, history, and retries under OpenCode's control.

**Release status:** npm `0.0.1` is the published release. The adapter architecture and recovery changes on `main` have not yet been published; installing `0.0.1` does not install those changes.

## Install

Add to `opencode.json(c)`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["opencode-account-rotate@0.0.1"],
}
```

Keep only one installation entry. If necessary, reload OpenCode's backend to load the plugin; Desktop uses backend configuration, not `cli.json`.

Sign in to multiple accounts through OpenCode's authentication UI. No separate plugin login or configuration is required. Installation does not switch accounts.

## How it works

1. Confirm explicit quota exhaustion and attribute the failed request to a saved credential.
2. Cool down that credential until a recognized reset, or for five minutes when no reset is known.
3. Activate the next eligible saved account through OpenCode and wait up to ten seconds for candidate readiness.
4. Let OpenCode retry within its existing allowance, provided continuation is compatible.

There is one account list across ChatGPT token-sharing, Codex browser/headless, and saved API keys—not separate sign-in-method pools. HTTP, WebSocket, and fallback requests participate in attribution; auxiliary title/generate requests do not.

**OpenAI is the only enabled provider.** Custom destinations, external credentials, and unreviewed packages/SDK transports are unmanaged. The shared adapter/profile architecture on `main` does not automatically enable other providers.

**Activation is global and persistent**, affecting other sessions and locations. Local queues cannot make it atomic against manual switches or other processes. There is no automatic rollback.

## Recovery limits

- **You may need to submit again.** Prepared compaction can continue only through guarded same-route/settings, header-only replacement. Otherwise activation remains in effect, but a fresh submission is required.
- **No context rewriting.** Request bodies and opaque state are untouched. Cross-account encrypted-state portability is not guaranteed.
- **Recovery is conservative.** Ambiguous attribution is refused. Some mid-stream failures never reach retry hooks, and native retry allowances still apply.
- **Switching is not atomic across clients.** Manual changes, other locations/processes, and cancellation can race with activation. There is no automatic rollback.

Public retry hooks lack request IDs, request kinds, and cancellation signals. State is bounded and expires; lifecycle-stream failure degrades cleanup until reload. Dispatch guards fail the operation rather than providing a typed cancellation API. Register this plugin after authentication/transport-mutating plugins; later authentication changes can invalidate attribution.

See [recovery and validation boundaries](docs/recovery.md) and [architecture](docs/architecture.md).

## Development

```sh
npm ci --ignore-scripts
npm run typecheck
npm run build
node .github/scripts/verify-package.mjs
git diff --check
```

`dist/` is ignored, not committed. CI and publishing both generate it and verify the exact npm payload and plugin entrypoint. Published packages include compiled output because OpenCode installs with lifecycle scripts disabled. **Build first when loading a source checkout directly.** No user configuration is changed by the build.

No tests or test files are included. See [architecture and provider-extension guidance](docs/architecture.md) for development boundaries.

## Validation status

Static/package checks do not validate live recovery. Real-account Desktop acceptance across sign-in methods, concurrent/manual switches, throttling, tools, compaction, opaque state, WebSocket fallback, cancellation, and exhaustion **remains unvalidated**.

Maintainers: [publishing](docs/publishing.md). API reference: [OpenCode V2 plugins](https://opencode.ai/v2/docs/build/plugins).
