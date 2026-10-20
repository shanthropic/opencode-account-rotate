# Project constraints

- Do not write tests or test files. Verify with `npm run typecheck` and `npm run build`.
- Use native account activation across all saved OpenAI sign-in methods; do not introduce separate method-based pools or duplicate credentials.
- Rotate only on confirmed quota exhaustion; leave ordinary rate-limit handling to OpenCode.
- Keep authentication refresh, request replay, tools, and history under OpenCode's control.
- Read `README.md`'s compaction and validation limitations before changing recovery behavior.
