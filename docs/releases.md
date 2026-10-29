# Application releases

Flowmark uses GitHub pull requests and the existing Vercel Git integration:

```text
feature branch → PR into staging → Staging verification
  → release PR into main → Production verification → application GitHub Release
```

GitHub Actions runs PR checks. Vercel deploys the four hosted apps when their
branches change. There is no separate release deployment Action. Agent skills
help an operator perform this workflow when requested; they are not background
automation. `apps/dev-harness` and `apps/internal-docs` remain local-only.

## Branches and merge policy

| Change                           | Start from               | PR target | Merge method                                  |
| -------------------------------- | ------------------------ | --------- | --------------------------------------------- |
| Feature, fix, infrastructure     | Current `origin/staging` | `staging` | Squash                                        |
| Application release              | Long-lived `staging`     | `main`    | Merge commit                                  |
| Hotfix/main-only synchronization | `main`                   | `staging` | Merge commit                                  |
| Emergency Production hotfix      | Current `origin/main`    | `main`    | Squash, then merge `main` back into `staging` |

Normal work starts on a separate branch after fetching origin. Multiple feature
PRs can accumulate in Staging. Always select the PR base explicitly; GitHub's
default branch remains `main`. The PR workflow runs for either base: the fast
format/lint/typecheck/unit job and the disposable-Postgres integration job must
both pass before merge. Run `pnpm check` before pushing and creating the PR;
see [database integration tests](./development.md#database-integration-tests)
for the local equivalent of the integration job.

Release and synchronization PRs use merge commits to preserve shared ancestry.
Squashing a release would leave the original Staging commits outside main's
history and make later release comparisons misleading. Never delete `staging`
after a merge, reset shared branches, force-push them, or rebase their published
history. If the repository no longer allows merge commits, stop before release.

No synchronization PR is required after an ordinary release. Main's extra
release merge commit does not mean Staging is missing code. Continue creating
features from staging and use merge commits for subsequent release PRs.

Synchronize **base `staging`, head `main`** only when main has independent file
changes, such as a hotfix or an explicitly approved direct change. Inspect the
main-only commits and endpoint diff; being behind in commit count or failing
an ancestry check alone is not a blocker. Review conflicts and test the combined
candidate before release. Merge synchronization PRs by merge commit with approval;
never reset or rewrite shared branches. Do not use GitHub's update-branch button
on a release PR without reviewing its effects.

For an emergency, branch from main so unfinished Staging work stays out of the
hotfix. Review and verify that hotfix independently, obtain approval to merge
to main, verify Production, then merge main into staging through a separate
approved synchronization PR. Never merge staging into main to backport a fix.

## Prepare a release

Ask the agent to **prepare a Flowmark release**, using the repository
`release` skill. It uses the `pull-request` skill for PR formatting and checks.

1. Fetch branch heads and tags. Compare `origin/main...origin/staging` for
   commits, file changes, migrations, and infrastructure changes. Also compare
   the two endpoint trees: a divergent merge base can hide hotfix conflicts.
   Check main-only commits for independent changes and synchronize those when needed; a release merge commit alone does not require synchronization.
   Stop if there is no releasable file change, even if synchronization added
   commits to the history.
2. Verify CI and all four Staging deployments at the candidate Staging SHA.
   Record the SHA, URLs, checks, and manual test evidence. A prior manual pass
   applies only to the revision it tested; rerun affected checks after changes.
   Include sign-in, project/key creation, ingest, and dashboard reads when
   relevant. API health alone does not verify database access or authentication.
3. Inspect pending schema changes and required operator actions before merge.
4. Propose a version and prepare release notes from actual commits and changes
   since the previous application tag. For the first application release, state
   the baseline explicitly; do not treat an SDK package version as an app tag.
5. Open a PR with **base `main`, head `staging`**, titled `release: vX.Y.Z`.
   Use the public PR template: version and release range in Summary; features,
   fixes, and important changes in Changes; CI and Staging evidence in
   Verification; breaking changes and rollback constraints in Impact & Risks;
   migrations and ordered manual steps in Deployment Notes. Never link internal
   planning files. Stop for review; preparing a release does not authorize merge.

Use application tags `vMAJOR.MINOR.PATCH`: patch for compatible fixes, minor for
features, and major for breaking changes after 1.0. Before 1.0, call out breaking
changes and normally propose a minor bump. The maintainer chooses the version.
App versions are Git tags; they do not require bumping workspace or SDK package
versions. Keep SDK releases on their separate `sdk-v*` tags and npm workflow.

GitHub-generated release notes can be a starting point, but may hide feature
PRs merged into staging. Inspect the complete commit/file range between app
tags and include the underlying changes. No `.github/release.yml` is required:
label grouping alone would not solve that history problem.

## Database prerequisites

Inspect every change under `packages/db/migrations/`, including SQL and the
Drizzle journal, and corresponding schema changes. Git differences identify
candidates; they do not prove what a database has applied. Before a hosted
migration, verify that environment's Drizzle history and the reviewed SQL.
Already-applied migrations must remain unchanged.

Follow expand-and-contract: apply compatible additive SQL before deploying an
app that requires it, verify the schema, deploy and verify the app, perform any
explicitly approved backfill, and contract only in a later migration when old
revisions no longer need the old shape. Check defaults, nullability, and writes
from the previous revision as well as reads. A rollback must remain compatible.

Hosted migrations are manual operator commands requiring explicit approval,
using the environment-specific wrappers. Never run them in Vercel builds or
PR checks. Do not merge a release until required pre-deploy migrations are
confirmed. Command-guard hardening (TASK-007) must be completed before the
first release containing schema changes. See [development](./development.md)
for database commands. No release preparation authorizes seed, reset, or restore.

## Complete and verify a release

Before merging, re-read the PR's current head/base SHAs, full diff, CI, Staging
evidence, mergeability, and migration prerequisites. If the reviewed candidate
changes, renew the affected verification and approval. Obtain explicit approval
for the exact release PR and merge commit operation. Keep `staging` intact.

Merging into main triggers Vercel. Record the resulting main merge SHA and
verify **each** project: `flowmark-web`, `flowmark-docs`, `flowmark-dashboard`,
and `flowmark-api`. Confirm Ready state, Production target, deployed SHA, and
the canonical domain's current deployment. A green build or working old domain
is insufficient. Check API health and relevant app behavior, auth, ingestion,
database compatibility, and unintended environment changes. Record failures;
do not tag an unverified rollout as successful.

After successful verification, prepare notes and ask approval to create the
application tag and publish the GitHub Release at that **exact verified SHA**.
Do not use a moving main head as the target. Check existing tags/releases first;
never move an existing tag or silently overwrite a release. Reconcile partial
attempts before retrying. Publishing is separate from deployment and is not
automatic. Synchronize only if main has independent changes that staging needs.

## Release status and recovery

Ask **what is ready to release?** for a read-only report. The agent reports the
latest application tag reachable from main, the actual Production deployment
SHAs, untagged deployed changes, pending Staging changes, CI/deployment evidence,
and blockers. There may be no application tag yet. GitHub's latest SDK release
must not be reported as the application version. Mixed Production revisions
must be reported per project rather than as one successful release.

If deployment or smoke checks fail, stop publication and report the affected
projects, revision, symptoms, and recovery options. With explicit approval,
the operator can revert the faulty change through a PR (which deploys on merge)
or roll an affected Vercel project back to a verified compatible deployment.
Verify all affected domains and SHAs afterward. Application rollback does not
undo SQL. Never drop columns, reverse a migration, or restore Production as an
automatic rollback. Database recovery remains a separate operator procedure;
the reference deployment's restore drill is still pending. Maintainers should
consult their infrastructure recovery notes before any database action.

## Permissions and first test

The workflow preserves main protection and maintainer bypass. Staging protection
is a separate live setting: it is not added by these docs. Require the existing
CI check operationally even if a maintainer can bypass GitHub rules. Changes to
repository settings require approval; no plan upgrade or second reviewer is
required by this workflow.

Test this change with a feature PR into staging, CI, and a read-only release
status/preparation review. Check the candidate diff without merging to main or
creating tags. Verify the actual Production merge, publishing, and handling of
any independent main changes during approved releases, not through a dummy
release. An ordinary release needs no post-release synchronization PR.
