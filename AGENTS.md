# Project constraints

- Do not write tests or test files. Verify with `npm run typecheck` and `npm run build`.
- Prefer the centralized standard adapter and reviewed declarative profiles. Custom adapters require concrete behavioral exceptions and must reuse shared primitives.
- OpenAI is the only enabled provider. Do not enable providers through protocol or package-name inference.
- Derive native account binding from `provider.integrationID ?? provider.id`; inspect the effective model package, canonical identity, variant, and credential representation separately.
- Use native account activation across all saved OpenAI sign-in methods; do not introduce separate method-based pools or duplicate credentials.
- Rotate only on confirmed quota exhaustion; leave ordinary rate-limit handling to OpenCode.
- Preserve provider/model/variant. Keep authentication refresh, runtime initialization, request replay, retry budgets, tools, and history under OpenCode's control.
- Require conservative destination/authentication attribution. Custom-adapter refusal must never fall through to generic recovery.
- Bound retained state, keep resolved credentials short-lived, and use fixed sanitized diagnostics.
- Read `docs/recovery.md` before changing recovery behavior; document public-hook, concurrency, compaction, and validation limitations.
- Validate nested package contents with `node .github/scripts/verify-package.mjs` and rebuild tracked `dist/` before completing source changes. Remove only obsolete generated artifacts.
