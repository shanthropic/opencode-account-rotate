# Recovery architecture

```text
OpenCode native APIs / public session hooks
  → provider-neutral engine (core/)
  → custom-first adapter registry
      → OpenAI specialization using shared standard primitives
      → centralized standard adapter + reviewed profiles
      → unsupported
```

OpenAI is the only enabled provider. The standard registry is deliberately empty; OpenAI composes its own reviewed profile with `StandardAdapter`. Shared hashing, destination validation, direct-token inspection, quota interpretation, and configuration fingerprints are exercised by OpenAI, not a disconnected future framework.

## Responsibilities

- `src/index.ts`: public plugin definition; `runtime.ts`: hooks, integration services, lifecycle/disposal.
- `core/types.ts`, `model.ts`: native binding and effective public catalog snapshots. Models already include provider defaults; variants merge settings/body recursively and headers case-insensitively. Provider-only transport settings stay separate. These helpers do not reproduce runtime initialization.
- `core/accounts.ts`: one stable saved-account inventory/order per integration; coalesced, short-lived native credential resolution.
- `core/coordinator.ts`, `rotation.ts`: bounded integration queue, cooldowns, chains, native activation, readiness, and continuation authorization.
- `core/dispatch.ts`: preparation generations, transport evidence, attempt completion, collision refusal, and dispatch guards.
- `adapters/contract.ts`, `registry.ts`: capabilities and custom-first resolution. A custom refusal is terminal; it must never fall through to standard behavior.
- `adapters/standard/`: one implementation, declarative profiles, authentication inspection and quota policy. No primary authentication injection.
- `adapters/openai/`: reviewed methods, endpoints, account headers, quota exceptions, readiness, and prepared-compaction capability.

## Identity

`provider.integrationID ?? provider.id` alone determines the native account-selection domain. Provider ID identifies the configured model namespace. Effective model package (including model overrides), canonical identity, variant, and credential representation determine implementation compatibility; they are not alternative account-selection authorities.

Cooldowns are integration/credential scoped. Providers sharing an integration share its inventory and activation queue. Chains additionally bind session, provider/model/variant, implementation identity, and a local chain ID. Dispatch generations reject stale asynchronous updates; they are not native selection revisions.

One conservative slot per session deliberately rejects overlapping primary/compaction preparations, including cross-provider overlaps. WebSocket and HTTP fallback from one preparation share a logical dispatch. Ordinary failed attempts finish bookkeeping without consuming quota-recovery authority. Only confirmed, attributed exhaustion consumes that authority.

Authentication fingerprints are namespaced by integration/provider/package/profile/route. Observed association collisions invalidate authority rather than overwrite it. Only hashes and minimal non-secret metadata are retained; resolved credential values remain transient native-resolution inputs.

## Adding a standard provider

Review source and public hooks before adding an entry to `standard/profiles.ts`. Specify exact reviewed package entrypoints, configured/canonical identities, supported direct credential representations, authentication/identity headers, trusted destination boundaries, configuration readiness, and explicit exhaustion/non-exhaustion/reset policies. Native `provider.quota` is primary evidence, not unconditional rotation permission.

Review native and `aisdk:` implementations separately. Shared credential injection or an OpenAI-compatible protocol does not prove equivalent transport hooks, quota semantics, or continuation safety. Signing, token exchange, unknown transformations, external references, discovery-bound settings, and arbitrary destinations are not standard direct authentication.

Prefer a profile assignment over a new adapter. Introduce a custom adapter only for genuinely different control flow. Activation eligibility and automatic-continuation capability are separate: OpenAI can activate unfamiliar saved methods without guessing their transport behavior.

Standard prepared-compaction replacement is disabled. Any new prepared-continuation capability needs equivalent evidence to OpenAI's narrowly guarded implementation. See [recovery boundaries](recovery.md).

## State limits

Per instance: at most 32 integration services, 512 session slots, and 256 authentication associations. Per integration: at most 64 pending recoveries, 64 concurrent credential resolutions, 1,024 inventory entries, 512 chains, and 1,024 cooldowns/candidates per chain. Excess inventory/queue capacity fails conservatively rather than splitting account order or activation queues. Dispatch/association/chain authority expires after thirty minutes; cooldowns expire at their reset. Disposal aborts local operations and clears retained state. Native resolution already underway may finish later.

Architecture/source review used OpenCode checkout `4617210822bdbb31e5749751afbfb4584ccedac8`, with relevant public contracts checked against `v2.0.32`. Newer accepted V2 releases still require compatibility review.
