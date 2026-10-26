---
name: flowmark-npm
description: >-
  Publish @flowmarkdev/core and @flowmarkdev/node to npm. Use when releasing
  the SDK, bumping package versions, running a prerelease, configuring trusted
  publishing, or answering how to ship a new Flowmark npm version.
---

# Flowmark npm release

Public packages are `@flowmarkdev/core` and `@flowmarkdev/node` only. The
operating notes are in [docs/sdk-release.md](../../../docs/sdk-release.md).
Ask before publishing. Never publish `@flowmark/api`, `db`, `ui`, or apps.

The unscoped name `flowmark` is an npm security holding package. The
`@flowmark` scope is owned by someone else. Do not use either.

## Packages

| Package | Path | Dist-tags |
| ------- | ---- | --------- |
| `@flowmarkdev/core` | `packages/core` | `alpha`, then `latest` |
| `@flowmarkdev/node` | `packages/sdk` | same version as core |

Keep both package `version` fields aligned. Users install
`@flowmarkdev/node`; core is a normal dependency.

## Auth

npm account / org: `flowmarkdev`.

```sh
npm whoami
```

If logged out: `npm login` and let the user finish web auth + 2FA. Do not
invent tokens, do not put auth tokens in the repo, and do not print
`~/.npmrc` contents.

Laptop publish requires 2FA (OTP / web confirm). Prefer the GitHub Actions
workflow after trusted publishers are configured.

## Recurring release (preferred)

npm uses **staged publishing**: CI uploads a stage; a human approves with
2FA before the version is installable. Local npm CLI must be **≥ 11.15.0**
for `npm stage` commands (`npm install -g npm@^11.15.0`).

1. Confirm the user asked to publish.
2. Bump `version` in both `packages/core/package.json` and
   `packages/sdk/package.json` to the same value.
3. Run pack checks:

```sh
pnpm --filter @flowmarkdev/core test
pnpm --filter @flowmarkdev/node test
pnpm --filter @flowmarkdev/core build
pnpm --filter @flowmarkdev/node build
pnpm --filter @flowmarkdev/core pack
pnpm --filter @flowmarkdev/node pack
```

Inspect packed manifests: no `workspace:*`, `dist/` and types present.

4. Commit the version bump (only if the user asked for a commit).
5. Trigger `.github/workflows/publish-sdk.yml` via `workflow_dispatch`
   (`tag=alpha` or `tag=latest`), or push a `sdk-v*` tag after the bump is
   on `main`. CI **packs with pnpm** (rewrites `workspace:*`) then
   **`npm publish` of the tarball** so Trusted Publishing OIDC works. Do
   not set `actions/setup-node` `registry-url` (it injects a fake token).
   Do not set a GitHub Environment on the job unless the same name is on
   the npm Trusted Publisher.
6. Node 22.14+, npm ≥ 11.15.0 for OIDC.
7. If npm staged the release, approve with 2FA on the website
   [Staged Packages](https://www.npmjs.com/) tab (core first), or:

```sh
npm stage list
npm stage approve <stage-id>
```

8. After the version is live: `npm view @flowmarkdev/node version` / dist-tags,
   then smoke if needed.

Do not auto-publish on every push to `main`. Do not treat CLI
`+ @scope/pkg@version` alone as installable until `npm view` shows that
version.

## Laptop bootstrap / emergency publish

Only when CI/OIDC is unavailable. Stage **core first**, then node.
Prereleases use `--tag alpha`. Stable uses `--tag latest` (default).

**Never use bare `npm publish` from a package folder.** It leaves
`workspace:*` in the published manifest and breaks installs. Always publish
through **pnpm**, which rewrites workspace dependencies:

```sh
npm install -g npm@^11.15.0   # for npm stage approve only
pnpm --filter @flowmarkdev/core build
pnpm --filter @flowmarkdev/node build
pnpm --filter @flowmarkdev/core publish --access public --tag alpha --no-git-checks
pnpm --filter @flowmarkdev/node publish --access public --tag alpha --no-git-checks
```

Inspect `pnpm pack` output before publish: `@flowmarkdev/core` must be a
semver, never `workspace:*`. If npm stages the release, approve both packages
(core first) on npmjs.com Staged Packages, or with `npm stage approve` (CLI
≥ 11.15.0).

## Trusted publisher setup (once per package)

After the first version exists on the registry, on each package page on
npmjs.com configure Trusted Publisher → GitHub Actions:

- Organization or user: `Mumma6`
- Repository: `flowmark`
- Workflow filename: `publish-sdk.yml`
- Environment name: `npm-publish`
- Allow `npm publish`

Then revoke long-lived publish tokens.

## Smoke after a release

```sh
FLOWMARK_API_KEY=... FLOWMARK_API_URL=https://api.flowmark.dev \
  FLOWMARK_SMOKE_EXPECT_REJECT=1 \
  node scripts/smoke-sdk-external.mjs
```

Or install the published tag in a clean external directory and run the same
script there. Do not print write keys.

## Docs to update when shipping latest

When promoting a stable release, update customer install copy so
`npm i @flowmarkdev/node` is the quickstart path, and refresh
[docs/infrastructure.md](../../../docs/infrastructure.md) npm status.
Keep [docs/sdk-release.md](../../../docs/sdk-release.md) as the operator
guide.
