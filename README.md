# OpenCode Account Rotate

Automatically switches between saved accounts when quota is exhausted. [MIT licensed](LICENSE).

- Uses your existing OpenCode sign-ins, including saved API keys—no separate login or credential copies.
- Keeps your selected provider, model, and variant unchanged.
- Leaves ordinary rate limits, credential refresh, tools, history, and retries under OpenCode's control.

## Install

Requires **OpenCode V2 2.0.32+** and multiple saved accounts for a supported provider.

Add the plugin to your global `~/.config/opencode/opencode.json(c)` (on Windows, `%USERPROFILE%\.config\opencode\opencode.json(c)`). To install only for a project, use that project's `opencode.json(c)` instead. Merge this entry with your existing settings:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["opencode-account-rotate@0.1.0"],
}
```

Keep only one installation entry across applicable configs. This is a server plugin; do not add it to `cli.json`.

Sign in to multiple accounts through OpenCode's authentication UI. No separate plugin login or configuration is required. Installation does not switch accounts.

Watched configuration changes reload automatically, and missing packages install in the background. Run `opencode plugin list` to check active plugins; if nothing loaded, restart the backend with `opencode service restart` when it is safe to interrupt work.

### Update or remove

The example pins version `0.1.0`. To update, replace that version in your existing entry; `opencode plugin update` skips exact version pins. To remove the plugin, delete its entry. Removing it does not restore a previously selected account.

## Provider support

Providers are enabled one at a time, after review. Nothing is enabled by matching tokens, protocols, or package names.

- [x] **OpenAI** — ChatGPT token-sharing, Codex browser/headless sign-ins, and saved API keys. Uses one saved-account list across all of them.
- [ ] **GitHub Copilot** — next candidate. Requires review of token exchange/expiry, Enterprise destinations, and quota behavior.
- [ ] **Other subscription sign-ins** — under consideration, subject to the same review.
- [ ] **API-key-only providers, OpenAI-compatible endpoints, external credentials, local models**.

Enabling a provider requires reviewed package entrypoints and model identity, a recognized credential form, trusted destinations, readiness checks, and exhaustion/reset rules. See [adding providers](https://github.com/shanthropic/opencode-account-rotate/blob/main/docs/architecture.md#adding-providers). Order is intent, not a schedule. Accounts must also match the selected model and active configuration; a recognized sign-in method is not a guarantee of live recovery.

## How it works

1. Confirm explicit quota exhaustion and attribute the failed request to a saved credential.
2. Cool down the credential until a recognized reset, otherwise five minutes.
3. Activate the next eligible saved account through OpenCode and check that it is ready for the selected model.
4. Let OpenCode retry within its existing allowance, provided continuation is compatible.

HTTP, WebSocket, and fallback requests are checked. Title generation and transient generation requests do not trigger rotation.

## Recovery limits

- **You may need to submit again.** Compaction or account compatibility can block automatic continuation after a switch.
- **No context rewriting.** Request bodies and opaque state are untouched. Cross-account encrypted-state portability is not guaranteed.
- **Recovery is conservative.** Ambiguous attribution is refused. Some mid-stream failures never reach retry hooks, and native retry allowances still apply.
- **Switching is global and persistent.** It affects other sessions and locations. Manual switches and cancellation can race with activation; there is no automatic rollback.

Place this plugin after plugins that change request authentication or transport.

**Live-account recovery has not been validated.** Successful installation and static checks do not establish live recovery correctness. See [recovery limits and validation](https://github.com/shanthropic/opencode-account-rotate/blob/main/docs/recovery.md).

## Troubleshooting

- **Plugin not active:** check the configuration entry, your OpenCode version, and `opencode plugin list`.
- **No account switch:** ordinary throttling, authentication failures, unsupported endpoints, and ambiguous credentials do not authorize rotation.
- **Switched but stopped:** check native sign-in status and model availability. If no usable account remains, wait for quota to reset or select a usable account before submitting again. If execution still stops, the selected account remains active—review the last tool results before resubmitting.

When reporting a problem, include OpenCode/plugin versions, sign-in method, and sanitized diagnostic messages prefixed with `[opencode-account-rotate]`. Never share credentials, authorization headers, prompts, or raw provider responses.

## Development

```sh
npm ci --ignore-scripts
npm run typecheck
npm run build
node .github/scripts/verify-package.mjs
git diff --check
```

`dist/` is generated in CI and never committed. CI and publishing build it, then verify the exact npm payload and entrypoint. Published packages include compiled output because OpenCode installs with scripts disabled. Build before loading a source checkout directly.

Requires Node.js 22+ for local development. No tests or test files are included. See [architecture and provider-extension guidance](https://github.com/shanthropic/opencode-account-rotate/blob/main/docs/architecture.md) and [publishing](https://github.com/shanthropic/opencode-account-rotate/blob/main/docs/publishing.md).
