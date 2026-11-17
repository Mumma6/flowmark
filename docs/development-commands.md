# Developer commands

Run commands from the repository root with pinned pnpm 10.18.1. Docker Compose
owns local PostgreSQL; Node applications and tooling run natively. See
[development setup](./development.md#local-postgresql-with-compose) for onboarding,
existing data and agent ownership. This inventory records the consolidation
review of every workspace manifest, root script, database CLI and Actions workflow.

## Root interface

Rust workspace tooling includes `pnpm rust:setup`, `rust:format` and `rust:check`
for the pinned toolchain and native verification. The current Flowmark Engine's
`pnpm rust:build` generates its WASM bindings; additional crates should join the
workspace with appropriate build and verification steps. See the
[Rust guide](./engine.md). `pnpm engine:verify-build` verifies the actual server build,
embedded WASM bytes and isolated traced bindings. These commands do not deploy.

| Command                                                                        | Behavior and reason to retain                                                                                                                                                                                     |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev:setup`                                                               | Copies missing public app env templates without overwriting configuration or printing credentials. No database writes.                                                                                            |
| `pnpm infra <operation>`                                                       | One guarded Compose dispatcher: `doctor`, `up`, `status`, bounded `logs`, `restart postgres`, non-destructive `down`. Verifies local engine, target and checkout ownership.                                       |
| `pnpm dev`                                                                     | Prepares env files, requires healthy owned Compose PostgreSQL, builds libraries once, then watches API, dashboard, harness, docs, internal-docs and dependencies. No migration or seed.                           |
| `pnpm dev:all`                                                                 | Same prerequisites and library watchers, plus the marketing site. This selects applications, not another infrastructure provider.                                                                                 |
| `pnpm dev:stack`                                                               | Prepares env files, starts this checkout's PostgreSQL with `infra up`, then watches every application, library, and Drizzle Studio. No migration or seed; run `db:setup` once beforehand.                         |
| `pnpm db:setup`                                                                | Builds db prerequisites, applies committed migrations, provisions local projects and the fixture account through auth. Idempotent; never resets telemetry.                                                        |
| `pnpm db:seed`                                                                 | Builds db prerequisites and provisions fixtures/account only. Useful after local fixture changes; does not migrate.                                                                                               |
| `pnpm db:migrate:local`                                                        | Explicit local migration using the same TypeScript CLI and Compose target proof as setup/Studio.                                                                                                                  |
| `pnpm db:generate`                                                             | Generates Drizzle SQL and metadata from schema changes. Does not apply SQL.                                                                                                                                       |
| `pnpm db:studio`                                                               | Starts only the guarded database browser on loopback port 4983. `dev:stack` starts this same task with the applications.                                                                                          |
| `pnpm db:reset-local-telemetry -- --confirm-local-telemetry`                   | Deletes only the operations project's local telemetry. Requires separate user approval; not onboarding or test cleanup.                                                                                           |
| `pnpm test`                                                                    | Discovers root `scripts/*.test.mjs`, then runs workspace unit tests through Turbo. No configured test target is required.                                                                                         |
| `pnpm test:integration`                                                        | Owns a unique Compose tmpfs PostgreSQL, builds/migrates/runs db and server suites, checks complete reports, removes only its containers/network. No seed or persistent volume.                                    |
| `pnpm build`                                                                   | Dependency-ordered workspace builds; needed for app artifacts and SDK packaging.                                                                                                                                  |
| `pnpm lint`                                                                    | Workspace ESLint checks.                                                                                                                                                                                          |
| `pnpm typecheck`                                                               | Workspace type checks with dependency builds.                                                                                                                                                                     |
| `pnpm format` / `pnpm format:check`                                            | Prettier write/check; different intentional effects.                                                                                                                                                              |
| `pnpm check:typescript`                                                        | Application format, lint, typecheck and unit tests; excludes native Rust checks and artifact verification.                                                                                                        |
| `pnpm check`                                                                   | Local application, native Rust and server/WASM verification. CI additionally checks guardian regressions, affected public builds and PostgreSQL integration. Stop dev watchers first.                             |
| `pnpm db:migrate`                                                              | Shared guarded migration entrypoint for hosted wrappers and the managed integration runner. Daily local work uses the explicitly local command above.                                                             |
| `pnpm db:migrate:preview` / `pnpm db:migrate:staging` / `pnpm db:migrate:prod` | Distinct hosted approval/branch/host guards, history preflight, migration and history verification. See [rollout](./migrations.md); never folded into local setup.                                                |
| `pnpm invite user@example.com`                                                 | Sends one private account invitation using explicitly configured existing database/email settings; no migration or seed. See [invite-only registration](./auth-perimeter.md#invite-only-production-registration). |
| `pnpm neon:env-pull`                                                           | Pulls ignored operator connection files. Use `-- --preview` or `-- --staging` for those branches; default is Production. Does not provision resources or rewrite app env.                                         |
| `pnpm release:verify`                                                          | SDK tests/builds, local tarball checks and version agreement; does not publish.                                                                                                                                   |

`--ui=stream` is forwarded to Turbo by `dev`, `dev:all` and `dev:stack`. Agents record
`infra up`'s `container` and `startedByThisCall`; stop with
`pnpm infra down --container <id>` only when they started it. Neither normal
stop nor test cleanup may delete volumes. Unit tests can run without Docker.

## Meridian Health demo

The private workstation fixture uses the existing application use cases and
guarded database connections. See [the operational guide](../packages/demo/README.md)
for the local build, account setup, and ownership checks.
It never runs as part of application startup or deployment.

| Command                                      | Behavior                                                                                                                                                                               |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm demo:plan --reference <UTC-timestamp>` | Deterministic 30-day plan without database access.                                                                                                                                     |
| `pnpm demo:setup --env local ...`            | Local auth registration/sign-in and owned project provisioning on the checkout Compose database. Password via secure stdin.                                                            |
| `pnpm demo:status --env local`               | Verifies the local target, key, ownership and manifest; reports dataset completeness.                                                                                                  |
| `pnpm demo:seed --env local`                 | Idempotent authenticated fixture ingestion into the local database.                                                                                                                    |
| `pnpm demo:reset --env local`                | Deletes only manifest-verified local demo runs/events and cascading projections. Requires `--confirm-local-reset`. Retains accounts, projects, keys, settings and unrelated telemetry. |
| `pnpm demo:reseed --env local`               | Verified local reset and seed in one transaction. Requires `--confirm-local-reset`.                                                                                                    |

Supported demo seeding is `--env local` against loopback, after `pnpm db:setup`.
`pnpm db:seed` provisions local fixtures and the local account; it does not
migrate and it refuses a hosted target. Do not seed, set up, reset, or reseed
Neon preview, staging, or production.

The demo CLI still accepts `--env staging` and requires
`--confirm-staging-setup`, `--confirm-staging-seed`, or
`--confirm-staging-reset` before those writes. Any other `--env` value,
including `production` and `preview`, is rejected. Those staging flags are
not an approved operating procedure. Do not run them. The integration suite
covers the same lifecycle against disposable loopback Postgres.

The disposable integration runner also executes Meridian provisioning,
ingestion, search/analytics, seed/reset/reseed and preservation coverage.
Ordinary unit runs skip its database case when no proven test target is supplied.

## Workspace scripts

These package-local commands support Turbo, root dispatchers or specific app
work. They are not competing local setup procedures.

| Workspace                                                       | Scripts and actual consumers                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/server`, `apps/dashboard`, `apps/dev-harness`, `apps/web` | `dev` runs Next.js bound to loopback; `build` produces the app artifact; `start` serves that artifact for self-hosting; `lint`, `typecheck`, `test` supply Turbo/CI checks. Direct dev requires built dependencies. Harness always binds to loopback.                                                                     |
| `apps/docs`                                                     | Same app/check commands; `prebuild` and `pretypecheck` generate Fumadocs MDX before those operations. Tests verify links, navigation and SDK snippets.                                                                                                                                                                    |
| `apps/internal-docs`                                            | `dev`, `build`, `start`, `lint`, `typecheck` and MDX lifecycle hooks. Renders contributor docs, binds to loopback; never deployed.                                                                                                                                                                                        |
| `packages/core`, `packages/sdk`, `packages/api`                 | `build`, `dev` compiler watcher, `lint`, `typecheck`, `test`. Build output is consumed by app imports, tests and SDK packaging.                                                                                                                                                                                           |
| `packages/engine`                                               | `build` generates Rust/WASM and TypeScript output; `dev` watches the adapter TypeScript after the startup build; `lint`, `typecheck`, `test` verify the domain boundary. Rust changes use the explicit build workflow in the engine guide.                                                                                |
| `packages/auth`                                                 | Same library/check commands, plus `db:setup` and `db:seed` called directly by the root. Owns fixture account provisioning; depends on db without a reverse dependency.                                                                                                                                                    |
| `packages/db`                                                   | Compiler `build` / `dev`, `lint`, `typecheck`, unit `test`; `infra`, `test:integration`, `db:generate`, `db:studio`, `db:migrate`, `db:reset-local-telemetry` implement root commands.                                                                                                                                    |
| `packages/db` operator tools                                    | `db:migrations:verify` verifies committed hashes/timestamps (hosted wrapper preflight/postflight); `db:schema-baseline` supports explicit approved schema-only Preview/Staging adoption; `db:facts:backfill` is bounded local dry-run/apply with project scoping and Compose proof. These have distinct safety contracts. |
| `packages/ui`                                                   | `build`, `lint`, `typecheck`, `test`; shared primitives consumed by apps.                                                                                                                                                                                                                                                 |
| `packages/email`                                                | Private server-only mail library: `build`, `dev`, `lint`, `typecheck`, `test`. `send:test` is the guarded Staging delivery command in the package README. It is not local setup and does not run during tests.                                                                                                            |
| `packages/mcp`                                                  | `build`, `dev`, `lint`, `typecheck`, `test` for the MCP adapter consumed by the server. Not a second local infrastructure path.                                                                                                                                                                                           |
| `packages/evidence-view`                                        | `build`, `lint`, `typecheck`, `test` for supplied-data evidence projection. No dev watcher.                                                                                                                                                                                                                               |
| `packages/config`                                               | Shared configuration only; no scripts.                                                                                                                                                                                                                                                                                    |
| `infrastructure`                                                | Separate Pulumi pnpm project with `typecheck` and compiled `test`. Resource mutation requires reviewed Pulumi preview/apply approval; local Compose is unrelated.                                                                                                                                                         |

`turbo.json` retains the `dev:ready` build barrier, native watchers and standard
build/check graph. Its concurrency stays above the persistent dev tasks so
`dev`, `dev:all` and `dev:stack` can run every watcher. `db:studio` is a persistent Turbo task used by `dev:stack`
and by the standalone command. `pnpm dev` and `pnpm dev:all` do not run it.
The root pnpm workspace continues to include `apps/*` and `packages/*`;
infrastructure keeps
its separately pinned provider project. No Dockerfiles or application containers
are needed.

## Script implementation inventory

| Files                                                                                                          | Consumer, purpose and disposition                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/prepare-dev.mjs`                                                                                      | `dev:setup`; retained as non-overwriting env preparation, with Compose-only guidance.                                                                                                                       |
| `scripts/db-migrate-{preview,staging,production}.mjs`                                                          | Hosted root commands; retained distinct target/approval checks. Both baseline callers now use the single `db:schema-baseline` implementation.                                                               |
| `scripts/db-migrate-ci.mjs`                                                                                    | Protected Actions jobs only; exact reviewed SHA/approval and three pinned hosts, temporary operator files, cleanup. Retained.                                                                               |
| `scripts/db-env-neon.mjs`, `scripts/db-migration-steps.mjs`                                                    | Shared hosted file/target parsing and fail-fast history → migration → verification. Imported by wrappers/tests; retained.                                                                                   |
| `scripts/neon-env-pull.mjs`, `packages/db/neon.ts`                                                             | Operator connection-file retrieval and existing Neon CLI branch configuration. Retained for the documented hosted fallback; not a local provisioning mechanism or permission to create branches.            |
| `scripts/release-deployment.mjs`                                                                               | Approved merge pipeline preflights/projects/revision, deploys API first, checks health/SHA and aliases. Retained.                                                                                           |
| `scripts/release-verify.mjs`                                                                                   | Root SDK packaging verification; retained.                                                                                                                                                                  |
| `scripts/vercel-should-deploy.mjs`                                                                             | All four hosted apps' ignored-build command before install; pinned `npx turbo-ignore@2.11.10`. Retained. Its duplicate installed root devDependency was removed.                                            |
| `scripts/smoke-sdk-external.mjs`                                                                               | Explicit external-consumer/hosted ingestion smoke with provided credentials. Retained; executing it against hosted environments still requires approval.                                                    |
| `scripts/benchmark-sdk.mjs`                                                                                    | Offline SDK benchmark with mocked fetch; useful diagnostics, retained.                                                                                                                                      |
| `scripts/*.test.mjs`, `scripts/github-main-ruleset.json`                                                       | Root regression suites and branch-policy fixture. Referenced by tests/CI; retained. Root test discovery no longer requires a manual file list.                                                              |
| `packages/db/src/cli/infra.ts`                                                                                 | Compose dispatcher; retains container/volume identity, port, context and ownership checks. `--require-ready` is the dev preflight.                                                                          |
| `packages/db/src/cli/{migrate,apply-migrations,verify-migrations,migration-history,stamp-preview-baseline}.ts` | Authoritative Drizzle apply/history/baseline tools; retained. Migration and verification share target proof for Compose development, disposable tests and approved hosted wrappers.                         |
| `packages/db/src/cli/{test,test-integration,integration-checks,integration-command,integration-reports}.ts`    | Unit discovery, disposable-test lifecycle, scoped process interruption, workspace lock and complete-report verification. Retained to protect real data and avoid success with skipped integration coverage. |
| `packages/db/src/cli/{local-seed,seed-local-development,reset-local-telemetry}.ts`, `packages/auth/src/cli/*`  | Project/account provisioning and separately approved scoped reset. Retained; removed unused seed exports and reverse package-script delegation.                                                             |
| `packages/db/src/cli/{backfill-run-facts,run-facts-options,connection,run}.ts`                                 | Bounded facts maintenance, option validation, scoped driver connections and typed CLI failures. Retained with Compose proof.                                                                                |
| `packages/sdk/examples/*.mjs`                                                                                  | Runnable SDK demonstrations; application telemetry examples, not infrastructure scripts. Retained.                                                                                                          |

## Removed

- Native-provider selection, its implicit fallback, bypass of Docker ownership
  checks, and the generic local target-comparison implementation it required.
- `scripts/db-migrate-local.mjs`: duplicated env loading/validation/subprocess
  handoff. Local migration now calls the shared TypeScript migration CLI.
- Root `dev:product` and `dev:stream`: redundant selections. `dev` is the product
  default; use `--ui=stream` for logs and `dev:all` for additional apps.
- Root `neon:env-pull:preview` and `neon:env-pull:staging`: aliases for existing
  flags; callers now use the single `neon:env-pull` command.
- Db package `db:setup` and `db:seed`: reverse delegation into auth. Root already
  owns these commands and calls auth directly.
- Db package `db:preview-baseline`: duplicate of `db:schema-baseline`; actual
  Preview and Staging callers use the retained guarded implementation.
- Db package `studio` alias and Turbo `studio` task: duplicate automatic browser
  startup; the explicit `db:studio` command remains.
- Root installed `turbo-ignore` dependency: deployment executes the version-pinned
  command before dependency installation and does not use that installed copy.

No deprecated aliases, unmanaged provider fallback, data transfer script or
replacement schema history is retained. Existing database data is not obsolete
code and is never deleted by this cleanup.

## Hosted and CI boundaries

All four Actions workflows remain: PR `check` plus isolated PostgreSQL 18
integration service, manually approved database migration, activated
Staging/Production migrate-and-deploy, and separately approved SDK publication.
CI uses its declared disposable Actions service through `--ci-service`; this
is an isolated CI adapter, not an alternative contributor setup. No hosted
resources, secrets, migration history or deployment activation are changed.

## Engineering feedback

- `pnpm factory:check origin/staging` checks new deterministic architecture and
  documentation regressions against the fetched base, including working files.
- `pnpm factory:local prepare` selects new PR heads, recent merges and a weekly
  review scope using the existing local GitHub login; no model is invoked.
- `pnpm factory:local source <id> <path> [line] [--trusted]` reads prepared public
  source/base instructions without checking out or executing PR code.
- `pnpm factory:local checks <id> <pr-number>` reads known CI failure annotations
  for retrospective evidence without executing logs.
- `pnpm factory:local complete <id> <result.json> [--publish]` validates and records
  local AI review/learning results; only current source-backed PR findings publish.
- `pnpm factory:local status` shows local memory/report progress.

See [Software Factory](./software-factory.md) for the local Codex schedule,
private memory, limits and human-approved proposal workflow.
