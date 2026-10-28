# Recovery and troubleshooting

## When does rotation happen?

Recovery requires explicit quota exhaustion and an unambiguous match to the sending saved credential. Rotation applies only to enabled providers (currently OpenAI); other providers keep OpenCode's normal handling. A generic quota category, HTTP 429, payment failure, expired plan, or model restriction is not enough. Ordinary rate limits stay under OpenCode's retry policy.

Authentication, billing, eligibility, and model restrictions do not trigger rotation. OpenCode remains responsible for sign-in and credential refresh.

The exhausted credential cools down until a recognized reset, or for five minutes. Recovery uses one native saved-account order across sign-in methods and never revisits excluded candidates within the same chain. Unavailable candidates are not marked quota-exhausted.

OpenCode resolves credentials and activates candidates from the saved-account list. The plugin checks readiness for the selected provider/model/variant and makes another pass for newly available accounts before giving up. An unfamiliar sign-in method may be activated, but automatic continuation requires recognized authentication.

## Why did execution stop after switching?

Switching accounts does not guarantee that the current request can continue. The plugin stops recovery when account selection, authentication, destination, or model compatibility cannot be verified. OpenCode's retry allowance still applies, and some failures never reach the plugin's retry hooks.

Primary requests are rebuilt by OpenCode. The plugin does not submit another prompt, rewrite history, or replay tools itself.

If asked to **submit again**, the newly selected account remains active. Check native sign-in status, model availability, and the last tool results before resubmitting.

### Conversation compaction

Compaction summarizes a conversation to make room for further work. It may reuse a request prepared before the account switch. OpenAI continuation is allowed only when the route and account-neutral settings remain compatible and authentication can be safely replaced. Otherwise you must submit again.

Intervening compaction must preserve the pending primary request's account expectations. A different compaction agent, model, or variant is conservatively refused while primary retry permission is pending.

No transcript, tool result, encrypted reasoning, or checkpoint is rewritten. Cross-account encrypted-state portability is not guaranteed; provider rejection is not bypassed by stripping context.

## What if no usable accounts remain?

Automatic quota recovery stops rather than cycling indefinitely. Accounts that fail readiness checks are skipped without being marked quota-exhausted. The last activated account remains selected; there is no rollback. Wait for quota to reset or select a usable account, then submit again.

## How do other sessions and manual switches behave?

**Activation is global and persistent.** It affects other sessions and locations. Local activation queues cannot make switching atomic against manual changes or other processes. Selection checks reduce races but cannot detect every external switch.

Cancellation is best-effort. Account activation or credential resolution already underway may finish after interruption. Automatic rollback could overwrite a newer manual selection, so none is attempted.

## Integration limitations

- Register this plugin after plugins that change authentication or transport. Later changes can invalidate request attribution.
- Public retry hooks lack request IDs, request kinds, and cancellation signals. Unsupported overlapping requests cannot be reliably correlated.
- Guard failures stop the operation rather than providing a clean cancellation API.
- Account activation is not a provider-reload barrier. Readiness is checked before retry approval and authentication is checked again before dispatch.

If lifecycle tracking ends, cleanup and cancellation degrade until reload. Retained recovery state is bounded; capacity exhaustion refuses recovery. Attribution and permissions expire after thirty minutes.

Expired evidence cannot authorize rotation or prepared-authentication replacement. Expiry and plugin reload also remove memory-only continuation guards: protection does not survive those boundaries. Diagnostics use fixed messages without credentials, account identifiers, prompts, or provider bodies. See [architecture](architecture.md) for implementation details.

## Validation

```sh
npm run typecheck
npm run build
node .github/scripts/verify-package.mjs
git diff --check
```

Also check formatting. Package verification checks the exact compiled payload, loads the public entrypoint, and verifies adapter selection for reviewed OpenAI packages and refusal of unsupported packages or identities. OpenCode v2.2.0's native OpenAI entrypoints were source-reviewed; this is not live recovery acceptance. No tests or test files are included. Static checks and successful installation do not establish live recovery correctness.

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
