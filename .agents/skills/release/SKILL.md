---
name: release
description: >-
  Prepare a Flowmark application release, complete an approved release, or
  report release readiness and Production status. Use for staging-to-main
  release PRs, application version tags, and GitHub Releases. SDK npm publishing
  uses flowmark-npm instead.
---

# Flowmark application release

Read [application releases](../../../docs/releases.md) for the branch policy,
versioning, migration prerequisites, verification, and recovery procedure.
Apply [Git safety](../../../.cursor/rules/git-safety.mdc). Use
[pull-request](../pull-request/SKILL.md) for public PR content and its local
check gate, and [flowmark-vercel](../flowmark-vercel/SKILL.md) when inspecting
deployments. Keep private operating records out of PRs and release notes.

## Prepare release

1. Inspect status, fetch origin and tags, and resolve the remote `main` and
   `staging` SHAs. Inspect repository merge settings and required checks.
   Compare both `origin/main...origin/staging` and `origin/main origin/staging`
   with `git diff`; inspect `git log origin/main..origin/staging`. If main is
   not an ancestor of staging, prepare the reviewed synchronization described
   in the guide; do not reset or merge shared branches without authorization.
2. Confirm releasable file changes (ancestry-only synchronization commits do
   not need a release), current CI, and all four Staging deployments at
   the candidate SHA. Attribute manual evidence to its tested revision. Missing
   evidence is a blocker, not a passed check. Do not create customer records
   just to prepare a release.
3. Inspect changed migrations, journal, schemas, infrastructure, and required
   manual operations. Stop a schema release until TASK-007 is complete and
   required approved pre-deploy migration results are recorded. Do not run a
   hosted migration during preparation. Git history is not database history.
4. Find application tags matching `vMAJOR.MINOR.PATCH` reachable from main;
   ignore `sdk-v*`. Inspect the full range since the previous app tag and the
   actual candidate diff. With no app tag, state the first-release baseline.
   Propose a version for the maintainer; do not bump SDK versions.
5. Draft notes from actual features, fixes, and important changes. Preserve the
   PR template's sections, adding version, release range, Staging/CI evidence,
   migrations, risks, and ordered manual actions. Do not rely only on release
   PR titles or generated notes.
6. After the PR skill's checks, create or update the release PR explicitly with
   `--base main --head staging`, title `release: vX.Y.Z`, and a body file.
   Reuse an existing release PR rather than creating duplicates. A blocked PR
   may be a draft with explicit blockers; never report it ready. Stop before
   merge. Opening a release PR does not require creating a new code branch.

## Complete release

1. Re-read the release PR, head/base SHAs, checks, mergeability, candidate diff,
   Staging evidence, and migration prerequisites. Check current permission and
   merge settings. Honor existing authorization for the exact operation; ask
   only for missing approval. Renew review if the candidate has changed.
2. Merge only with explicit approval, using a merge commit and retaining
   staging. With `gh`, use `--merge --match-head-commit <reviewed-head-sha>`;
   do not use auto-merge, delete the branch, or bypass failed checks.
3. Record the resulting main merge SHA. Observe all four Production projects
   using the Vercel skill. Confirm deployed SHA, Ready state, canonical-domain
   alias, health, relevant auth/ingest behavior, database compatibility, and
   unexpected env changes. Report failures and propose recovery using the
   guide; no automatic rollback or tag publication.
4. After verification, prepare the application tag and notes at the exact
   verified SHA. Inspect existing tags/releases and reconcile partial attempts.
   Obtain approval for tag creation and GitHub Release publication, then use
   the explicit SHA as target. Never move a tag, use an SDK tag, or dispatch
   npm publishing as part of an app release.
5. Prepare the synchronization PR explicitly with base `staging`, head `main`.
   Merge by merge commit only when authorized, then fetch and verify main is
   an ancestor of staging. Skip synchronization when already true. Do not
   delete staging, force-push, reset, or rebase it.
6. Report version/tag, verified Production SHA and deployments, checks, release
   URL, synchronization state, and remaining manual steps.

## Review release status

This mode is read-only: do not fetch, write files, open PRs, run migrations,
change settings, or publish. Use GitHub read-only APIs to resolve current
branch heads, comparisons, tags/releases, PR checks, and deployments rather
than relying on stale local refs. Inspect Vercel through read-only commands.

Report the latest app tag reachable from main and actual Production SHAs;
distinguish an untagged or mixed rollout from a tagged version. Summarize
changes in staging but not main, pending migrations, current Staging evidence,
failed or missing checks, and required maintainer decisions. State readiness
with blockers explicitly. If an API or CLI is unavailable, label that state
unverified; never substitute SDK release metadata or cached evidence for a
current Production verification.
