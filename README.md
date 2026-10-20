# OpenCode Account Rotate

Rotates existing saved **OpenAI** accounts on confirmed quota exhaustion through OpenCode V2's native activation API. Requires **OpenCode 2.0.32+**. [MIT licensed](LICENSE).

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

## Behavior

- One native saved-account list across ChatGPT token-sharing, Codex browser/headless, and API keys. No credential duplication or method-based pools.
- Explicit exhaustion evidence and unambiguous hashed dispatch attribution are required. Ordinary throttling stays under OpenCode's retry policy.
- Exhausted credentials cool down until a recognized reset, or for five minutes. Candidate readiness waits up to ten seconds.
- OpenCode resolves and refreshes credentials and rebuilds primary retries. Provider, model, variant, history, tools, and retry budgets remain native.
- HTTP, WebSocket, and fallback share attribution. Custom destinations, external credentials, and unreviewed packages/SDK transports are unmanaged.
- OpenAI is the only enabled provider. The shared adapter/profile architecture does not automatically enable other providers.

**Activation is global and persistent**, affecting other sessions and locations. Local queues cannot make it atomic against manual switches or other processes. There is no automatic rollback.

## Recovery limits

Primary retries are rebuilt by OpenCode and checked again at dispatch. Prepared compaction can continue only through OpenAI's guarded same-route/settings, header-only replacement. Otherwise the account remains switched and you must **submit again**. No body or opaque state is rewritten; cross-account encrypted-state portability is not guaranteed.

Public retry hooks lack request IDs, request kinds, and cancellation signals. Ambiguous attribution is refused. State is bounded and expires; lifecycle-stream failure degrades cleanup until reload. Later authentication-mutating plugins can invalidate attribution, so register this plugin after them. Dispatch guards fail the operation rather than providing a typed cancellation API.

Some mid-stream failures never reach retry hooks. Native retry allowances still apply. Automatic continuation is not universal.

See [recovery and validation boundaries](docs/recovery.md) and [architecture](docs/architecture.md).

## Development

```sh
npm ci --ignore-scripts
npm run typecheck
npm run build
node .github/scripts/verify-package.mjs
git diff --check
```

`dist/` is generated locally and in CI, not committed. Both workflows build and verify the compiled npm payload; the publishing workflow includes it because OpenCode installs packages with lifecycle scripts disabled. Build first when loading a source checkout directly. The build does not change user configuration. No tests or test files are included.

Static/package checks do not validate live recovery. Real-account Desktop acceptance across sign-in methods, concurrent/manual switches, throttling, tools, compaction, opaque state, WebSocket fallback, cancellation, and exhaustion **remains unvalidated**.

Maintainers: [publishing](docs/publishing.md). API reference: [OpenCode V2 plugins](https://opencode.ai/v2/docs/build/plugins).
