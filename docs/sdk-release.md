# SDK release

Operating notes for publishing `@flowmarkdev/core` and `@flowmarkdev/node`.
Customer docs do not include this file. Agent releases should follow
[`.agents/skills/flowmark-npm/SKILL.md`](../.agents/skills/flowmark-npm/SKILL.md).

The `@flowmark` npm scope is owned by another publisher, and the unscoped name
`flowmark` is an npm security holding package. Public packages use the
`flowmarkdev` scope, matching `flowmark.dev`.

## Packages

| Package | Path | Consumers install |
| ------- | ---- | ----------------- |
| `@flowmarkdev/core` | `packages/core` | Transitive dependency of the Node SDK |
| `@flowmarkdev/node` | `packages/sdk` | `npm i @flowmarkdev/node` |

Internal apps keep `"private": true`. Do not publish API, DB, UI, or apps.

Stable line: **`0.1.0+`** on the `latest` tag. Publish with the workflow
`tag=latest` (default). Avoid bare `npm publish` — it can leave
`workspace:*` in the manifest.

Always publish with **`pnpm --filter ... publish`**, never bare `npm publish`
from a package directory — only pnpm rewrites `workspace:*`. npm may still
**stage** the release: approve both packages (core first) on the Staged
Packages tab before installs work.

## Bootstrap status

Done once:

1. npm org `flowmarkdev`, 2FA, local `npm login`.
2. First laptop publish of `0.1.0-alpha.0` (core, then node) and staged
   approval.
3. GitHub Environment `npm-publish` and
   [`.github/workflows/publish-sdk.yml`](../.github/workflows/publish-sdk.yml).
4. Public GitHub repository `Mumma6/flowmark`.

Still configure on each package page if missing: Trusted Publisher → GitHub
Actions → `Mumma6` / `flowmark` / `publish-sdk.yml` / environment
`npm-publish`. Prefer allowing `npm stage publish` for CI. After that, do not
keep long-lived publish tokens.

## Recurring release

1. Bump `version` in both package manifests (keep them aligned).
2. Pack-verify; no `workspace:*` in the tarball.
3. Merge, then run the publish workflow (`workflow_dispatch` or `sdk-v*` tag).
   CI runs `npm stage publish` for core, then node.
4. Approve staged packages with 2FA.
5. Smoke: `scripts/smoke-sdk-external.mjs` against `https://api.flowmark.dev`.
6. Only then promote a stable `0.1.0` on the `latest` tag and drop `@alpha`
   from customer install copy.

Ask before every publish.
