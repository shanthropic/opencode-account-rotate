# npm releases with GitHub OIDC

Releases use GitHub Actions trusted publishing, without an npm token. Publishing is separate from development and requires explicit authorization.

## Workflows

- `.github/workflows/ci.yml`: typecheck, generate `dist/`, inspect the exact npm payload, and load the public entrypoint.
- `.github/workflows/publish.yml`: new `v*` tags; requires a stable matching package version on a commit reachable from `main`, rejects existing npm versions, and publishes with provenance through OIDC.

Both use pinned actions and GitHub-hosted runners, with dependency lifecycle scripts disabled. The workflow files define the Node/npm versions. Only publishing receives `id-token: write`. Releases are serialized without cancellation.

The npm trusted publisher must match GitHub repository `shanthropic/opencode-account-rotate`, workflow filename `publish.yml`, environment `npm`, and direct-publish permission. No `NPM_TOKEN` fallback is supported. Maintainers should protect the environment, release tags, main branch, and workflow changes using repository rules.

## Release

1. Update `package.json`, `package-lock.json`, and the README's installation and update examples to the intended stable version.
2. Run typecheck, build, and `.github/scripts/verify-package.mjs`; commit source changes and wait for CI. `dist/` is ignored, not committed; both workflows generate it from source before package verification. The publishing workflow includes it in npm even with lifecycle scripts disabled.
3. Create a **new** `v<version>` tag on the reviewed `main` commit and push that tag.
4. Approve the environment deployment if required and confirm that the publishing workflow succeeds.
5. Verify npm availability, the `latest` tag, tarball metadata, and provenance. Registry processing can delay availability even after npm accepts publication:

   ```sh
   npm view opencode-account-rotate@<version> version dist-tags dist.tarball dist.attestations --json --prefer-online
   ```

   Replace `<version>` with the release version. If npm is still processing it, check again later; do not republish.

Never move a published tag or republish an existing npm version. If publication may have succeeded before a later failure, inspect registry state before taking action.

Authentication failures require checking the exact trusted-publisher fields, hosted runner, workflow permissions, and npm policy. `npm whoami` does not validate OIDC, and a package dry run does not validate registry authorization.

Publication does not change installation or restart OpenCode. Install/update the plugin only as a separately authorized integration action. Installation is not [live recovery acceptance](recovery.md#validation).
