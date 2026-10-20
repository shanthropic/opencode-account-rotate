# npm releases with GitHub OIDC

Releases use GitHub Actions trusted publishing, without an npm token. Publishing is separate from development and requires explicit authorization.

Version **0.1.0** uses release tag `npm-v0.1.0`. Package metadata, the lockfile, and the README installation example must agree on the release version.

## Workflows

- `.github/workflows/ci.yml`: typecheck, generate `dist/`, inspect the exact npm payload, and load the public entrypoint.
- `.github/workflows/publish.yml`: new `npm-v*` tags; requires a stable matching package version on a commit reachable from `main`, rejects existing npm versions, and publishes with provenance through OIDC.

Both use pinned actions, GitHub-hosted runners, Node 24, and npm 11.19.0, with dependency lifecycle scripts disabled. Only publishing receives `id-token: write`. Releases are serialized without cancellation.

The npm trusted publisher must match GitHub repository `shanthropic/opencode-account-rotate`, workflow filename `publish.yml`, environment `npm`, and direct-publish permission. No `NPM_TOKEN` fallback is supported. Protect the environment, release tags, main branch, and workflow changes using appropriate repository rules; this document does not establish that those protections are configured.

## Release

1. Update `package.json` and `package-lock.json` to the intended stable version.
2. Run typecheck, build, and `.github/scripts/verify-package.mjs`; commit source changes and wait for CI. `dist/` is ignored, not committed; both workflows generate it from source before package verification. The publishing workflow includes it in npm even with lifecycle scripts disabled.
3. Create a **new** `npm-v<version>` tag on the reviewed `main` commit and push that tag.
4. Approve the environment deployment if required; verify registry version, tarball metadata, and provenance.

Never move a published tag or republish an existing npm version. Tags without the `npm-v` prefix do not trigger publication. If publication may have succeeded before a later failure, inspect registry state before taking action.

Authentication failures require checking the exact trusted-publisher fields, hosted runner, workflow permissions, and npm policy. `npm whoami` does not validate OIDC, and a package dry run does not validate registry authorization.

Publication does not change installation or restart OpenCode. Install/update the plugin only as a separately authorized integration action. Installation is not [live recovery acceptance](recovery.md#validation).
