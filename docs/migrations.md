# Database changes and rollout

Keep schema, generated SQL/Drizzle metadata, API, SDK, UI, tests and documentation
in one coherent feature PR. Generate once; apply the same committed migrations
in each database. Never edit an applied migration or use ad hoc SQL to bypass
Drizzle history. A Git merge does not migrate a database.

## Who does what after activation

- The agent prepares one full-stack feature PR with schema, generated migrations,
  API/SDK/UI changes, tests and rollout notes.
- The maintainer reviews and merges the feature PR into `staging`.
- **Migrate and deploy** verifies the merged commit, migrates Staging, deploys
  API first and then dashboard/docs/web, and verifies deployment results.
- The agent prepares a release PR from `staging` into `main` after Staging
  verification. The maintainer reviews and merges it.
- The same pipeline applies only still-pending Production migrations, then
  deploys and verifies Production. Already-recorded migrations are not replayed.

Merge approval authorizes that reviewed change's migration/deployment to the
branch's environment once the pipeline is deliberately activated. No separate
chat approval is needed for those same steps. GitHub Environment reviewers may
be added if a second production approval is desired; the merge is the default
maintainer gate for this workflow. Seed, reset, restore, data cleanup, backfills,
SDK publishing and destructive maintenance are not included in that approval.

## Order and completion gates

1. **Implement locally.** Generate and inspect SQL; apply locally. Test the flow
   using disposable loopback PostgreSQL. PR checks have no hosted secrets.
   Add upgrade coverage with representative synthetic data when rows, defaults,
   constraints or backfills are affected; an empty-DB pass is not upgrade proof.
2. **Verify Preview before feature merge.** Preview remains separate from Staging.
   Apply approved PR migrations there using the standalone migration workflow or
   guarded workstation wrapper, and verify the PR deployment. Shared Preview
   schema changes must be coordinated. Per-PR Neon branches are future separate
   provisioning/lifecycle work, not created by this PR.
3. **Merge to Staging.** The `push` workflow reuses both PR verification jobs on
   the exact merged SHA. Only after success does it preflight the four Vercel
   projects, check migration history, migrate Staging, verify history, deploy and
   verify. No manual migration before merge is needed once activated.
4. **Release to main.** Review Staging evidence and the release PR. Merge starts
   the same ordered pipeline for Production. Production migration belongs to
   release, not feature implementation acceptance. SDK publication remains a
   separately approved operation after accepting backend deployment.

Implementation completion, feature merge readiness, Staging rollout and Production
release are separate states. Do not hold an otherwise completed implementation
open solely for a future Production release. Record tested commits and environment
results in PR/release notes.

For additive changes, migrate before deploying dependent code. The app currently
serving traffic must still work with the expanded schema during rollout; this is
deployment sequencing, not a product compatibility layer. App rollback does not
undo SQL. Keep additive schema if deployment fails and investigate before retrying;
there is no automatic rollback, reset or reverse migration.

Renames/removals, required fields on populated tables and large backfills need an
explicit staged plan: add the new shape, deploy its use, backfill when approved,
then remove unused shape in a later release. Do not merge destructive maintenance
into the routine automatic rollout. No real users does not make resetting data
or rewriting migration history part of ordinary migration work.

## Controlled merge pipeline

`.github/workflows/deploy-release.yml` runs on pushes to `staging` and `main`.
It is opt-in through `FLOWMARK_RELEASE_PIPELINE_ENABLED=true`. Until setup is
complete it fails before any mutation. All four app `vercel.json` files disable
independent Vercel Git deployments for these **two** branches. Feature-branch
PR previews stay enabled. The migration and deployment jobs share a concurrency
lock with standalone migrations; running rollouts are never cancelled by a newer
push. A failed check/migration prevents deployment.

The pipeline checks out the push's exact SHA, sets its branch metadata in a
throwaway checkout, builds database dependencies without hosted credentials,
checks existing project IDs/team/root directories, then uses the guarded
migrations and verifier. No secrets or pulled app env files are uploaded as
artifacts. The database URL is exposed only to the migration step; the Vercel
token only to authenticated deployment/preflight steps. Ordinary verification
jobs never receive them.

Deployment uses pinned Vercel CLI 65.7.0 and remote builds, preserving Vercel's
existing branch-scoped variables and monorepo settings. It builds all four
projects for a consistent revision; this deliberately costs four builds per
successful rollout. API deploys first. Production builds are staged with
`--skip-domain`, checked, then promoted one project at a time. Staging API and
dashboard are assigned their existing canonical domains; Staging web/docs use
their unique Preview deployment URLs. No new domains or projects are created.

Verification checks project, READY state, exact SHA and target, API health with
reported SHA, HTTP responses and canonical aliases. Protected URLs use
`vercel curl`; protection is not disabled. These are automated availability and
revision checks, not proof of every authenticated business flow. Relevant auth,
ingestion and investigation behavior still needs release acceptance evidence.
A later failure can leave some projects updated and others on the previous
revision; the workflow stops and reports failure, never claims an atomic rollout
or automatically reverses successful migrations/promotions.

### One-time activation before merging this infrastructure change

The source is prepared in the PR; no GitHub/Vercel settings or hosted databases
have been changed by implementation. Configure and review these before merging:

- GitHub Environments `deploy-staging` and `deploy-production`, restricted to
  `staging` and `main` respectively. Protect both branches so only reviewed,
  authorized changes can merge. Disable administrator environment bypass.
  Optional required reviewers add an extra approval step; omit that extra gate
  when maintainer merge approval is the intended authorization.
- Each environment's secrets: `MIGRATION_DATABASE_URL` (only its own database's
  direct TLS URL, `sslmode=require`) and `VERCEL_TOKEN` (scoped to the existing
  team/projects). Configure tokens directly in GitHub, never paste them in chat.
- Repository variables: `VERCEL_ORG_ID`, `VERCEL_API_PROJECT_ID`,
  `VERCEL_DASHBOARD_PROJECT_ID`, `VERCEL_DOCS_PROJECT_ID`, `VERCEL_WEB_PROJECT_ID`;
  and distinct direct `MIGRATION_PREVIEW_HOST`, `MIGRATION_STAGING_HOST`,
  `MIGRATION_PRODUCTION_HOST` without credentials. Verify IDs/branch identity
  against the existing Vercel/Neon projects. Keep Vercel system environment
  variables exposed so the checked-out branch metadata reaches the existing
  Staging guards and branch-scoped settings. These names are setup inputs, not
  claims of remotely configured state.
- Set `FLOWMARK_RELEASE_PIPELINE_ENABLED=true` only when the above is complete
  and rollout activation is approved. Source `git.deploymentEnabled` disables
  the competing Git deploy when this PR reaches each long-lived branch. Do not
  leave an independent Deploy Hook/workflow deploying those branches in parallel.

The push workflow is available on `staging` as soon as this PR merges there;
it does not wait for the default branch to receive it. First activate and verify
Staging, then release the workflow/config to main and verify Production. If the
flag/config is missing after merge, the old deployment stays serving and the new
rollout fails; finish setup and rerun the failed workflow rather than bypassing
migration checks. Review the source/config cutover before merging.

## Automated hosted migration job

The separate **Migrate database** workflow (`database-migrate.yml`) is a separate,
manual-dispatch Actions job. It does not run on pushes or PRs, deploy an app,
merge code, seed, reset, restore, baseline or publish packages.

Once activated, an operator selects an environment and full reviewed commit SHA,
then approves the matching protected environment job:

```sh
gh workflow run database-migrate.yml --ref main \
  -f target=preview -f sha=<reviewed-40-character-commit-sha>
```

The routine Staging/Production path is the merge pipeline above. Standalone
Staging/Production migrations are an explicitly approved recovery/manual fallback;
use `production` only for a reviewed release candidate reachable from Staging. Review the SQL **and** candidate code,
since the job executes that commit. Dispatch from `main`, where the workflow is
reviewed; do not dispatch a modified feature-branch workflow. A changed candidate
requires renewed affected verification and approval.

The job performs protected-environment preflight, checks out the exact commit,
installs pinned dependencies, builds database dependencies without hosted
credentials, checks applied history against the candidate, runs the existing
environment wrapper, and verifies complete history afterwards. All migration
jobs are serialized and running jobs are never cancelled by a newer dispatch.
A failure stops the workflow; do not continue to merge/deploy. Inspect before
retrying: some SQL may already have committed. The summary records environment
and SHA. Check affected tables/constraints and the application flow as well;
matching hashes do not prove the absence of manual schema drift.

### One-time activation

This is repository code, not proof that hosted automation is configured. The
workflow must first exist on `main`; candidates must contain its runner/verifier.
Until then, use the workstation wrappers below. No workflow, secret or environment
is created remotely just by adding these files to a PR.

With explicit maintainer approval, configure:

- GitHub Environments `database-preview`, `database-staging`, `database-production`,
  each with at least one required reviewer and administrator bypass disabled.
  Restrict deployment branches to `main`. For a solo maintainer, allow that
  maintainer to approve their own dispatch; approval is still deliberate.
- In each environment, secret `MIGRATION_DATABASE_URL`: **only that database's**
  direct PostgreSQL URL with TLS (`sslmode=require`). Never use a pooled URL.
  Do not add hosted credentials as repository-wide secrets or to PR jobs.
- Repository variables `MIGRATION_PREVIEW_HOST`, `MIGRATION_STAGING_HOST`,
  `MIGRATION_PRODUCTION_HOST`: the three distinct exact **direct** Neon hosts,
  without credentials. Verify their branch identities in Neon during setup.
  Host pinning does not independently prove Neon branch identity.

The job refuses missing reviewer protection, enabled administrator bypass,
wrong revision, missing variables, shared/mismatched hosts, pooled URLs, existing
local env files or inconsistent migration history. It creates temporary ignored
env files to reuse the workstation wrappers, removes them on completion and
never uploads them as artifacts. Preview/Staging get no Production credentials.
GitHub environment approval authorizes only that job's environment and revision;
it does not authorize merge, deploy, backfill or publication.

Shared `preview` is the current setup. Coordinate schema-changing PRs there;
another PR's schema can invalidate its results. A database branch per PR is a
future improvement requiring separate provisioning, lifecycle and cost work.

## Workstation fallback

Use the root commands with existing local operator files. Unset exported
`DATABASE_MIGRATION_URL`; wrappers pin and compare targets before delegating to
`pnpm db:migrate`. Each hosted wrapper checks applied history first and verifies
the complete history after migration. Hosted commands require approval for the environment and
reviewed revision. Existing authorization persists; do not ask again for the
same approved operation. Never run migrations inside Vercel builds or requests.

```sh
pnpm db:migrate:local
pnpm db:migrate:preview -- --confirm-preview-migrate
pnpm db:migrate:staging -- --confirm-staging-migrate
pnpm db:migrate:prod -- --confirm-production-migrate
```

Files are `packages/db/.env.neon.preview`, `.env.neon.staging` and `.env.neon`
for Production, all ignored. Do not copy hosted env into local app files. First
provisioning of a schema-only branch may need the documented baseline procedure;
that is a separate operation, never part of this routine rollout job.

For a disposable loopback test database, explicitly set **both** `DATABASE_URL`
and `DATABASE_MIGRATION_URL` to that test database before `pnpm db:migrate`.
Read-only verification uses the same target guards as migration:

```sh
pnpm --filter @flowmark/db db:migrations:verify
```

`--allow-pending` accepts only an exact applied prefix of the current commit's
migration history, for preflight. Normal verification requires every committed
migration's hash and timestamp to match. Workstation hosted verification must use
an explicitly pinned direct URL and the same wrapper target markers; the Actions
runner wires those automatically. Inspect schema and record tested commit,
environment, migration/history outcome and smoke-test result in PR/release notes.

## References

- [Drizzle migrations](https://orm.drizzle.team/docs/migrations)
- [GitHub deployment environments and approvals](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- [GitHub environment API](https://docs.github.com/en/rest/deployments/environments)
