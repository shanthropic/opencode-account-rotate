# Recovery and validation boundaries

Read this before changing activation, attribution, or retry behavior.

## Exhaustion and selection

Native `provider.quota` also covers payment, expired-plan, and entitlement failures. A reviewed policy must positively confirm exhausted allowance; recognized access failures and ordinary `provider.rate-limit` do not rotate. OpenAI additionally recognizes narrow explicit exhaustion codes/messages when native normalization is inconclusive. Arbitrary 429s and quota-like text are insufficient. Reset extraction is separate and uses only reviewed quota-reset fields, never throttle delays or response-header assumptions (retry hooks expose no header map).

The sending credential receives a cooldown until a recognized future reset or five minutes. There is no inferred organization-wide scope. A chain never revisits locally excluded candidates, even when cooldowns expire. Unready/unavailable candidates are not marked quota-exhausted.

Selection uses one stable native saved-account order across sign-in methods. Saved IDs are the only deduplication identity. OpenCode owns credential refresh/persistence. Environment-only credentials and external references do not participate in standard recovery.

Activation is serialized per integration within this instance. If another native selection has won, recovery assesses it rather than advancing again. Selection and binding are checked before activation and before continuation; inventory refreshes once before declaring no candidates. Each candidate has a ten-second readiness window.

OpenAI preserves native activation eligibility for unfamiliar saved methods, but never guesses continuation authentication. It can advance to another candidate without classifying the unfamiliar method as exhausted. If no compatible continuation exists, activation remains persistent and a fresh submission may be needed.

## Attribution and retry attempts

Preparation captures provider/model/variant, integration/implementation identity, session, agent, request kind, and local generation. Transport observation checks actual trusted destination/authentication. WebSocket plus HTTP fallback share preparation. Overlaps, observed credential-fingerprint collisions, stale generations, and unknown destinations lose recovery authority.

The retry hook first classifies evidence, inspects attribution, and finishes failed-attempt bookkeeping. Ordinary retries do not consume recovery authority; confirmed unambiguous exhaustion does. Primary preparation is rebuilt on retry; compaction can reuse its preparation. This distinction matters even for ordinary throttling.

Public retry hooks have no request ID, request kind, or cancellation signal. Local IDs do not eliminate those limits. Later authentication-mutating hooks can invalidate observations. Register this plugin after such plugins. Hashes, not tokens, are retained; diagnostics contain fixed messages without account IDs, provider bodies, prompts, or secrets.

## Two-stage readiness

Before retry: check native selection, binding, available model/variant, supported credential mode, and adapter-observable configuration. At dispatch: check actual destination and authentication against the authorized selection and local generation. Public catalog readiness alone does not prove runtime initialization or credential metadata/configuration effects.

Primary retries are rebuilt by OpenCode. The plugin neither rewrites primary authentication nor starts a new submission. Guard failures throw from public hooks. Source review confirms that hook failure propagates before the HTTP handler or WebSocket selection; this is an operation failure/defect, **not a typed clean cancellation mechanism**. Live Desktop presentation and fallback behavior remain unvalidated.

OpenCode advances its retry schedule before invoking the retry hook; exhausted schedules do not call it. Incoming `decision.retry: false` alone is not proof that the budget is exhausted. The plugin may authorize a quota retry within an available decision, but cannot extend the native allowance. Some failures after output begins never reach this hook. Tools, history, replay safety, and mid-stream handling stay native.

## Prepared compaction

Stock 2.0.32 prepares compaction once. The standard adapter does not replace its stale authentication. Without an explicit capability, activation requires a fresh submission instead of automatic continuation.

OpenAI permits replacement only when the route and account-neutral provider/model/settings fingerprint remain unchanged, native selection/readiness are confirmed, and outgoing stale authentication is recognized. Only bearer and account headers may change. A changed route, compaction mechanism, model setting, or unfamiliar authentication stops continuation after activation; **submit again** to prepare under the new selection.

No body, transcript, tool, encrypted reasoning, or checkpoint rewriting occurs. Cross-account opaque-state portability is not guaranteed. OpenCode owns incompatible-provenance transcript re-expansion; provider rejection is not bypassed by stripping context.

## Concurrency, cleanup, and cancellation

Native activation is global and persistent. There is no public compare-and-swap activation or globally awaited provider-reload barrier. Local serialization cannot detect every external switch (including switch-away-and-back), later hook change, or cross-location/process race. Checks narrow races; they cannot make activation atomic.

Terminal lifecycle events clear local session state and abort queued/waiting recovery. Timestamp/generation checks protect newer work where observable. Retry scheduling is not completion. Disposal aborts local work; credential resolution already underway may finish. Cancellation cannot undo committed activation, and automatic rollback could overwrite a newer selection, so none is attempted.

Lifecycle-stream failure degrades cancellation/cleanup until reload. Bounded maps/queues and thirty-minute attribution/chain expiry remain the fallback, not a guarantee of full tracking. Expired/evicted evidence cannot authorize recovery. State is memory-only and resets on reload.

## Validation

Required static checks:

```sh
npm run typecheck
npm run build
node .github/scripts/verify-package.mjs
git diff --check
```

Use read-only formatting checks as well. Package verification compares the exact nested compiled-module payload, rejects stale artifacts, and loads the public entrypoint. No tests or test files are added. CLI installation/module loading does not establish runtime hook initialization or quota-recovery correctness.

Live-account Desktop acceptance remains separate and **has not been performed**:

- Primary exhaustion across token-sharing, browser/headless Codex, and API keys.
- Manual switches, simultaneous sessions/locations, and selection changes during readiness.
- Ordinary throttling and native retry-budget exhaustion.
- Tools and pre-/post-output failures without duplicate execution.
- Same-/cross-route compaction, encrypted state, and incompatible checkpoint provenance.
- WebSocket reuse/fallback and transport guard failure propagation.
- Cancellation, lifecycle-stream failure, unfamiliar methods, and no usable candidates.

Do not consume live quota, publish, modify installed plugins, or restart the backend as part of static validation without separate authorization.
