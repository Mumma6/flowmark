# Database changes and rollout

Keep schema, generated SQL/Drizzle metadata, API, SDK, UI, tests and documentation
in one coherent feature PR. Generate once; apply the same committed migrations
in each database. Never edit an applied migration or use ad hoc SQL to bypass
Drizzle history. A Git merge does not migrate a database.

## Who does what

The agent prepares the full-stack PR, migration SQL, tests and rollout evidence.
The maintainer approves the reviewed change and merges it when its environment
prerequisites are satisfied. Automation runs only the authorized environment's
migrations and records the result; release approval remains with the maintainer.

**Current implementation:** the protected migration job is dispatched separately
before merge; Vercel still auto-deploys on merge. Merge alone does not start this
migration job. The agent/operator handles the approved migration step so the
maintainer does not have to type database commands.

**Desired fully automatic flow:** merge into Staging or main starts one controlled
pipeline: migrate the target database, stop on failure, deploy the apps, then
verify. Before enabling this, replace the independent Vercel Git deploy trigger
with that pipeline so deployments cannot race migrations. This PR does not change
Vercel project settings or implement that deployment orchestrator. Do not describe
the separate migration job as automatic migration-on-merge. Production then applies
all still-pending migrations included in the reviewed release; it does not replay
already-recorded migrations.

## Order and completion gates

1. **Implement locally.** Generate and inspect SQL. Apply it to the local loopback
   database; test the affected flow using a separate disposable database. PR CI
   applies migrations and runs real HTTP/PostgreSQL tests without hosted secrets.
   Also test upgrades with representative synthetic data when existing rows,
   defaults, constraints or backfills are affected. An empty-database pass alone
   is not upgrade evidence.
2. **Verify Preview.** Apply the reviewed PR commit's migrations to `preview`,
   then test its deployed API/dashboard. A feature implementation can be complete
   after code review and local/CI verification; record hosted rollout separately.
   Feature merge readiness requires relevant Preview verification and the Staging
   schema prerequisite below, not a Production migration.
3. **Prepare Staging, then merge.** Apply and verify compatible migrations from
   the reviewed feature commit to `staging` **before** merging its PR. Merge
   triggers Vercel deployment, so waiting until after merge can break the app.
   Verify the deployed Staging revision and affected user flow after merge.
4. **Prepare Production at release time.** After Staging verification and release
   approval, migrate `production` using the reviewed release candidate's commit,
   verify, then merge the release PR into `main`. Verify deployed applications.
   Production migration is a release gate, never a prerequisite for completing
   an ordinary feature PR into Staging. SDK publication follows accepting backend
   deployment and remains separately approved.

For additive changes, such as nullable columns and new tables, migrate before
code deployment. The currently deployed revision must still work with the expanded
schema. This is deployment sequencing, not a product compatibility layer. A
migration can succeed while a later deployment fails: normally keep additive
schema and roll back the app to a compatible revision. App rollback does not undo
SQL. Never automatically reverse a migration.

Renames, removals, required fields on populated tables and large backfills need
an explicit staged plan: add the new shape, deploy its use, backfill when needed,
then remove unused shape in a later release. No real users does not make schema
reset, data deletion or history rewriting part of routine migration work.

## Automated hosted migration job

The **Migrate database** workflow (`database-migrate.yml`) is a separate,
manual-dispatch Actions job. It does not run on pushes or PRs, deploy an app,
merge code, seed, reset, restore, baseline or publish packages.

Once activated, an operator selects an environment and full reviewed commit SHA,
then approves the matching protected environment job:

```sh
gh workflow run database-migrate.yml --ref main \
  -f target=preview -f sha=<reviewed-40-character-commit-sha>
```

Repeat for `staging` before feature merge. Use `production` only for a reviewed
release candidate reachable from Staging. Review the SQL **and** candidate code,
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
