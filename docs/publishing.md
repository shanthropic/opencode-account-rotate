# npm releases with GitHub OIDC

The package remains `opencode-account-rotate@0.0.1`. No npm publishing token is stored in GitHub. The workflow does not modify user configuration or restart OpenCode.

## Workflows

- `.github/workflows/ci.yml`: pull requests and pushes to `main`; installs locked dependencies, typechecks, builds, verifies tracked `dist/` is current, and inspects the npm payload and module entrypoint. No test suite is introduced.
- `.github/workflows/publish.yml`: new `npm-v*` tags; repeats validation, requires a stable version matching the tag and a commit reachable from `main`, rejects an existing npm version, and publishes via OIDC. GitHub/npm automatically attach provenance for this public repository and public package.

Both use GitHub-hosted runners, Node 24, pinned npm 11.19.0 (OIDC requires npm >=11.5.1), SHA-pinned actions, no dependency cache, and no dependency lifecycle scripts. Only the publishing job receives `id-token: write`. Publishing is serialized and does not cancel an active release.

## One-time owner setup

1. Choose a license before public publication. This repository does not currently declare one; the workflow does not choose a license for you.
2. Confirm you control an npm account with 2FA and that `opencode-account-rotate` is available. A registry 404 is not a guarantee that npm will permit the name.
3. Merge these workflows and package metadata into `main`.
4. Create the GitHub environment **`npm`**. Configure required reviewer approval if available and restrict deployment tags to `npm-v*`. Protect `main`, release tags, and workflow changes using repository rules. Do not create an `NPM_TOKEN` secret.
5. Bootstrap the npm package as described below. npm requires the package to exist before its trusted publisher can be configured.
6. On npmjs.com, open the package's **Settings → Trusted publishing** and configure:

   | Field | Exact value |
   | --- | --- |
   | Provider | GitHub Actions |
   | Organization/user | `shanthropic` |
   | Repository | `opencode-account-rotate` |
   | Workflow filename | `publish.yml` |
   | Environment name | `npm` |
   | Allowed action | Enable direct `npm publish` |

   The filename excludes `.github/workflows/`. The environment must match exactly. Do not grant separate dist-tag management unless needed.
7. Complete the first successful OIDC publish within **two days** of creating the trust configuration. Otherwise delete/recreate the expired configuration.
8. After verifying OIDC works, set npm publishing access to **Require two-factor authentication and disallow tokens**.

## Bootstrap without consuming stable 0.0.1

This is a one-time, interactive owner action, not a CI token workaround. It creates a real, publicly visible prerelease `0.0.1-bootstrap.0` on the `bootstrap` dist-tag. Do not publish an empty placeholder.

Use a separate temporary checkout of the reviewed release source so the main working tree remains at `0.0.1`. Authenticate with `npm login` yourself; never paste credentials into an agent conversation. In that checkout:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm version 0.0.1-bootstrap.0 --no-git-tag-version
npm run typecheck
npm run build
node .github/scripts/verify-package.mjs
npm publish --access public --tag bootstrap --ignore-scripts
```

Do not commit the bootstrap version change or push it to `main`. Configure the trusted publisher after the package exists. If the package is already owned by you and configured, skip bootstrap. If someone else owns it, stop and choose a different name rather than trying to publish.

## Stable release

Ensure `package.json` and `package-lock.json` agree on the stable version. Build and commit updated `dist/` with every source change. Wait for CI on the release commit to pass, then create a fresh tag at that reviewed `main` commit:

```sh
git tag npm-v0.0.1
git push origin npm-v0.0.1
```

Approve the `npm` environment deployment if required. The old `v0.0.1` tag is deliberately untouched and does not trigger this workflow. Future releases use `npm-v0.0.2`, etc.; npm versions are immutable. Never move a published release tag.

## Verification and failures

- Check `npm view opencode-account-rotate@0.0.1 version dist` and the provenance on npmjs.com.
- Verify installation through OpenCode and remove the old local entry only as a separate, explicit integration action. Installation does not validate live quota recovery; the README's acceptance limitations still apply.
- An existing version makes the workflow fail intentionally. If publication succeeded but the run later failed, verify registry state rather than attempting to republish.
- Authentication failures: check npm's exact repository/workflow/environment fields, direct-publish permission, configuration expiry, hosted runner, and job OIDC permission. `npm whoami` does not validate OIDC publishing.
- Do not add a fallback publishing token. A dry run verifies packaging, not registry OIDC authorization.

References: [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/), [npm trust prerequisites](https://docs.npmjs.com/cli/v12/commands/npm-trust).
