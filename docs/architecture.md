# Architecture

OpenAI is the only enabled provider.

```text
OpenCode hooks
  → shared recovery engine
  → custom adapter, standard profile, or unsupported
```

## Layout

- `src/index.ts`: plugin entrypoint.
- `src/runtime.ts`: hooks, integration services, and cleanup.
- `src/core/`: account inventory, model snapshots, activation queues, dispatch attribution, cooldowns, and recovery.
- `src/adapters/standard/`: shared authentication inspection, quota policy, and declarative provider profiles.
- `src/adapters/openai/`: OpenAI methods, endpoints, account headers, readiness, and compaction handling.
- `src/adapters/registry.ts`: custom-first adapter selection. A custom adapter's refusal never falls through to generic handling.

OpenAI reuses the standard adapter's shared primitives. The standard profile registry remains empty; other providers are not enabled automatically.

## Account and request identity

Use `provider.integrationID ?? provider.id` for native account selection. Providers sharing an integration share one account inventory and activation queue, regardless of sign-in method.

Use the effective model package, canonical identity, variant, and credential representation to decide compatibility. Model snapshots preserve recursive settings/body merges, case-insensitive headers, and provider-only transport settings. They do not initialize runtime models.

Recovery chains retain session, provider/model/variant, and integration identity. Local generations reject stale asynchronous updates. Cooldowns apply only to the exhausted integration/credential, not an inferred organization-wide quota.

Fresh primary/compaction preparation supersedes preceding bookkeeping in OpenCode's serialized execution flow; an unfinished slot alone does not establish overlap. Conflicting transport evidence and credential associations cannot authorize recovery. WebSocket and HTTP fallback share one preparation guard.

Verified recovery arms a separate pending primary permission. The next matching primary preparation consumes it; an eligible ordinary retry explicitly re-arms it without changing native delay. Successful steps do not inherit permission. Intervening compaction keeps primary permission separate, with verified account transitions or conservative refusal.

## Adding providers

Prefer a reviewed declarative profile over a new adapter. Profiles specify supported packages and identities, direct credential representations, authentication headers, trusted destinations, readiness checks, and exhaustion/reset rules.

Use a custom adapter only for genuinely different behavior. Review native and SDK transports separately; matching protocols or tokens do not establish safe recovery. External credentials, signing, token exchange, unknown transformations, and arbitrary destinations are not standard cases.

Keep activation eligibility separate from automatic continuation. Standard adapters do not replace prepared-compaction authentication. OpenAI's narrow exception must not become a generic fallback.

## State and safety

Keep credentials short-lived, retain only hashes and necessary metadata, and use fixed sanitized diagnostics. Bound inventories, queues, dispatches, associations, chains, and cooldowns. Capacity limits must refuse recovery rather than split coordination. Attribution and chains expire after thirty minutes; disposal clears local state and aborts recovery work.

OpenCode owns refresh, model initialization, replay, history, tools, and retry budgets. See [recovery limits](recovery.md) before changing this behavior.
