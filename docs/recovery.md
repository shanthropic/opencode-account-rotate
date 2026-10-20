# Recovery limits

## When accounts switch

Recovery requires explicit quota exhaustion and an unambiguous match to the sending saved credential. A generic quota category, HTTP 429, payment failure, expired plan, or model restriction is not enough. Ordinary rate limits stay under OpenCode's retry policy.

Reviewed exact exhaustion codes are recognized at the response root, `error`, or `response.error`, even when native normalization calls the failure a rate limit. Authentication, billing, eligibility, and capability exclusions across those envelopes take precedence. Message-only matching requires native quota classification and cannot override a rate limit. Authentication failures never trigger account rotation or custom refresh.

The exhausted credential cools down until a recognized reset, or for five minutes. Recovery uses one native saved-account order across sign-in methods and never revisits excluded candidates within the same chain. Unavailable candidates are not marked quota-exhausted.

OpenCode resolves and refreshes credentials. Each candidate gets up to ten seconds to become ready for the selected provider/model/variant. The inventory refreshes once before recovery declares no usable accounts remain. An unfamiliar OpenAI sign-in method may be activated, but automatic continuation requires recognized authentication.

## Retrying safely

Primary requests are rebuilt by OpenCode. The plugin checks native selection and model readiness before allowing retry, then checks the actual destination and authentication at dispatch. It does not replace primary authentication or submit a new prompt.

Recovery creates one pending primary permission, consumed by the next matching primary preparation. Its dispatch guard survives HTTP/WebSocket fallback. An eligible ordinary retry explicitly re-arms permission without changing native delay; success does not pass permission to the next tool-driven step. Native authentication recovery remains outside this permission re-arming path.

Fresh primary/compaction preparation supersedes preceding bookkeeping in the audited serialized execution flow. An unfinished slot alone does not imply overlap. Title and transient generation traffic is excluded. Conflicting transport evidence, credential collisions, stale state, and unknown destinations cannot authorize recovery. Retry hooks lack request IDs, request kinds, and cancellation signals, so unsupported overlap cannot be reliably correlated.

Register this plugin after authentication/transport-mutating plugins. Later changes can invalidate attribution. Dispatch guard failures stop the operation; they are not a clean cancellation API.

The implementation follows OpenCode **v2.0.32**: retry hooks may override an incoming no-retry decision after verified native recovery. The hard retry allowance is checked before hooks; the plugin cannot extend it. Native retry/continuation handles failures before and after output begins, including ordinary OpenAI quota error frames. The exceptional `LLMEvent.provider-error` path does not invoke retry hooks. Missing hooks cannot be diagnosed from lifecycle events alone.

Activation completion is not a provider-reload barrier. Readiness polling precedes approval, and dispatch still verifies authentication. Runtime initialization, credential refresh, history, tools, sockets, continuation instructions, and replay safety remain OpenCode's responsibility.

## Compaction

Compaction may reuse an already prepared request after an account switch. Standard adapters do not replace its stale authentication.

OpenAI allows header-only replacement when the trusted route and account-neutral settings remain unchanged, readiness is confirmed, and the stale authentication is recognized. Otherwise the account stays switched and you must **submit again**.

Automatic compaction can intervene before a primary retry. It does not consume the pending primary permission, even when a compaction hook supplies a result without transport. If compaction recovery changes the account again, that primary expectation transfers only after explicit binding, adapter, selection, and readiness verification. Currently this requires the same agent and full model/variant binding; a different compaction model is conservatively refused while primary permission is pending. Failed verification retains refusal rather than continuing unguarded.

A successful rotated compaction's prepared guard does not leak into or reject the next fresh primary preparation. Step/compaction settlement does not clear session recovery state: native partial-output continuation may publish step failure after retry approval.

No body, transcript, tool, encrypted reasoning, or checkpoint is rewritten. Cross-account opaque-state portability is not guaranteed; provider rejection is not bypassed by stripping context.

## Shared selection and cancellation

**Activation is global and persistent.** It affects other sessions and locations. Local activation queues cannot make switching atomic against manual changes or other processes. Selection checks reduce races but cannot detect every external switch.

Execution-terminal events and session deletion clear session state and abort queued or waiting recovery. Timestamp checks reject some delayed events, but public timestamps are not exact execution/request-generation IDs. Retry scheduling is not completion.

Promise session hooks supply no cancellation signal. Cancellation is best-effort through lifecycle tracking and generation checks; native activation or credential resolution already underway may finish after interruption. Cancellation cannot undo committed activation, and automatic rollback could overwrite a newer selection, so none is attempted.

If lifecycle tracking ends, cleanup and cancellation degrade until reload. Attribution and permissions expire after thirty minutes. State capacity is reserved before retry approval; active guards are not silently evicted to admit recovery. Capacity exhaustion refuses recovery. Resolved credentials are operation-local.

Expired evidence cannot authorize rotation or prepared-authentication replacement. Expiry and plugin reload also remove memory-only continuation guards: protection does not survive those boundaries. Diagnostics use fixed messages without credentials, account identifiers, prompts, or provider bodies.

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
- A successful tool step followed immediately by quota exhaustion, before/after output begins.
- Consecutive exhausted accounts and ordinary retries before/after rotation.
- A successful recovery followed by a normal step without inherited permission.
- Authentication, billing, eligibility, and capability exclusions, including contradictory envelopes.
- Intervening compaction, compaction rotation followed by primary continuation, and encrypted state.
- Same-/cross-route compaction and conservative different-model refusal.
- WebSocket reuse, fallback, and dispatch guard failures.
- Delayed lifecycle events, lifecycle-stream failure, and unfamiliar authentication methods.

Live quota use, publication, installation changes, and backend restarts require separate authorization.
