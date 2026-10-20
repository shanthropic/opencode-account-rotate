# OpenCode Account Rotate

Automatically switches between saved **OpenAI** accounts when quota is exhausted. Requires **OpenCode 2.0.32+**. [MIT licensed](LICENSE).

- Uses your existing OpenCode sign-ins—no separate login, credential copies, or API key required.
- Keeps your selected provider, model, and variant unchanged.
- Leaves ordinary rate limits, credential refresh, tools, history, and retries under OpenCode's control.

## Install

Requires **OpenCode V2 2.0.32+** and multiple saved OpenAI accounts.

Add the plugin to your global `~/.config/opencode/opencode.json(c)` (on Windows, `%USERPROFILE%\.config\opencode\opencode.json(c)`). To install only for a project, use that project's `opencode.json(c)` instead. Merge this entry with your existing settings:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["opencode-account-rotate@0.1.0"],
}
```

Keep only one installation entry across applicable configs. This is a server plugin; do not add it to `cli.json`.

Sign in to multiple accounts through OpenCode's authentication UI. No separate plugin login or configuration is required. Installation does not switch accounts.

Watched configuration changes reload automatically; missing packages install in the background. Run `opencode plugin list` to check active plugins. If the change has not loaded, restart the backend when it is safe to interrupt work with `opencode service restart`.

### Update or remove

The example pins version `0.1.0`. To update, replace that version in your existing entry; `opencode plugin update` skips exact version pins. To remove the plugin, delete its entry. Removing it does not restore a previously selected account.

## Supported accounts

Uses one saved-account list across ChatGPT token-sharing, Codex browser/headless sign-ins, and saved API keys. Accounts must be compatible with the selected model and OpenCode's active configuration to continue automatically.

**OpenAI is the only enabled provider.** Custom endpoints, external credentials, and alternative SDK transports are not managed. Recognition of a sign-in method is not a guarantee of live recovery support.

## How it works

1. Confirm explicit quota exhaustion and attribute the failed request to a saved credential.
2. Cool down that credential until a recognized reset, or for five minutes when no reset is known.
3. Activate the next eligible saved account through OpenCode and check that it is ready for the selected model.
4. Let OpenCode retry within its existing allowance, provided continuation is compatible.

HTTP, WebSocket, and fallback requests are checked. Title generation and transient generation requests do not trigger rotation.

## Recovery limits

- **You may need to submit again.** Conversation compaction (summarizing context) and account compatibility can prevent automatic continuation even after an account switches.
- **No context rewriting.** Request bodies and opaque state are untouched. Cross-account encrypted-state portability is not guaranteed.
- **Recovery is conservative.** Ambiguous attribution is refused. Some mid-stream failures never reach retry hooks, and native retry allowances still apply.
- **Switching is global and persistent.** It affects other sessions and locations. Manual switches and cancellation can race with activation; there is no automatic rollback.

Place this plugin after plugins that change request authentication or transport.

**Live-account recovery has not been validated.** Successful installation and static checks do not establish live recovery correctness. See [recovery limits and validation](https://github.com/shanthropic/opencode-account-rotate/blob/main/docs/recovery.md).

## Troubleshooting

- **Plugin not active:** check the configuration entry, your OpenCode version, and `opencode plugin list`.
- **No account switch:** ordinary throttling, authentication failures, unsupported endpoints, and ambiguous credentials do not authorize rotation.
- **Switched but stopped:** check native sign-in status and model availability. If no usable account remains, wait for quota to reset or select a usable account before submitting again.
- **“Submit again” message:** the selected account remains active, but the current request could not safely continue. Review the last tool results before resubmitting.

When reporting a problem, include OpenCode/plugin versions, sign-in method, and sanitized diagnostic messages prefixed with `[opencode-account-rotate]`. Never share credentials, authorization headers, prompts, or raw provider responses.

## Development

```sh
npm ci --ignore-scripts
npm run typecheck
npm run build
node .github/scripts/verify-package.mjs
git diff --check
```

`dist/` is ignored, not committed. CI and publishing both generate it and verify the exact npm payload and plugin entrypoint. Published packages include compiled output because OpenCode installs with lifecycle scripts disabled. **Build first when loading a source checkout directly.** No user configuration is changed by the build.

Requires Node.js 22+ for local development. No tests or test files are included. See [architecture and provider-extension guidance](https://github.com/shanthropic/opencode-account-rotate/blob/main/docs/architecture.md) and [publishing](https://github.com/shanthropic/opencode-account-rotate/blob/main/docs/publishing.md).
