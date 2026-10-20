# Recovery limits

## When accounts switch

Recovery requires explicit quota exhaustion and an unambiguous match to the sending saved credential. A generic quota category, HTTP 429, payment failure, expired plan, or model restriction is not enough. Ordinary rate limits stay under OpenCode's retry policy.

The exhausted credential cools down until a recognized reset, or for five minutes. Recovery uses one native saved-account order across sign-in methods and never revisits excluded candidates within the same chain. Unavailable candidates are not marked quota-exhausted.

OpenCode resolves and refreshes credentials. Each candidate gets up to ten seconds to become ready for the selected provider/model/variant. The inventory refreshes once before recovery declares no usable accounts remain. An unfamiliar OpenAI sign-in method may be activated, but automatic continuation requires recognized authentication.

## Retrying safely

Primary requests are rebuilt by OpenCode. The plugin checks native selection and model readiness before allowing retry, then checks the actual destination and authentication at dispatch. It does not replace primary authentication or submit a new prompt.

HTTP and WebSocket fallback share attribution. Overlapping requests, conflicting credential matches, stale state, and unknown destinations cannot authorize recovery. Retry hooks lack request IDs, request kinds, and cancellation signals, so correlation remains conservative.

Register this plugin after authentication/transport-mutating plugins. Later changes can invalidate attribution. Dispatch guard failures stop the operation; they are not a clean cancellation API.

OpenCode's retry allowance still applies. An incoming no-retry decision alone does not mean the allowance is exhausted, but the plugin cannot extend it. Some mid-stream failures never reach retry hooks. History, tools, and replay safety remain OpenCode's responsibility.

## Compaction

Compaction may reuse an already prepared request after an account switch. Standard adapters do not replace its stale authentication.

OpenAI allows header-only replacement when the trusted route and account-neutral settings remain unchanged, readiness is confirmed, and the stale authentication is recognized. Otherwise the account stays switched and you must **submit again**.

No body, transcript, tool, encrypted reasoning, or checkpoint is rewritten. Cross-account opaque-state portability is not guaranteed; provider rejection is not bypassed by stripping context.

## Shared selection and cancellation

**Activation is global and persistent.** It affects other sessions and locations. Local activation queues cannot make switching atomic against manual changes or other processes. Selection checks reduce races but cannot detect every external switch.

Terminal lifecycle events clear session state and abort queued or waiting recovery. Retry scheduling is not completion. Cancellation cannot undo committed activation, and automatic rollback could overwrite a newer selection, so none is attempted. Native credential resolution already underway may finish after cancellation.

If lifecycle tracking fails, cleanup and cancellation degrade until reload. State remains bounded and expires; expired or evicted evidence cannot authorize recovery. Memory-only state resets on reload. Diagnostics never include credentials, account identifiers, prompts, or provider bodies.

## Validation

```sh
npm run typecheck
npm run build
node .github/scripts/verify-package.mjs
git diff --check
```

Also check formatting. Package verification checks the exact compiled payload and loads the public entrypoint. No tests or test files are included. Static checks and successful installation do not establish live recovery correctness.

Live-account acceptance **has not been performed**. It must cover:

- All supported sign-in methods and exhausted account lists.
- Manual switches, simultaneous sessions, and cancellation.
- Ordinary throttling and retry-budget exhaustion.
- Tools and failures before/after output begins.
- Same-/cross-route compaction and encrypted state.
- WebSocket reuse, fallback, and dispatch guard failures.
- Lifecycle-stream failure and unfamiliar authentication methods.

Live quota use, publication, installation changes, and backend restarts require separate authorization.
