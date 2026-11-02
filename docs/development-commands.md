# Developer commands

Run commands from the repository root with pinned pnpm 10.18.1. Docker Compose
owns local PostgreSQL; Node applications and tooling run natively. See
[development setup](./development.md#local-postgresql-with-compose) for onboarding,
existing data and agent ownership. This inventory records the consolidation
review of every workspace manifest, root script, database CLI and Actions workflow.

## Root interface

| Command                                                                        | Behavior and reason to retain                                                                                                                                                  |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm dev:setup`                                                               | Copies missing public app env templates without overwriting configuration or printing credentials. No database writes.                                                         |
| `pnpm infra <operation>`                                                       | One guarded Compose dispatcher: `doctor`, `up`, `status`, bounded `logs`, `restart postgres`, non-destructive `down`. Verifies local engine, target and checkout ownership.    |
| `pnpm dev`                                                                     | Prepares env files, requires healthy owned Compose PostgreSQL, builds libraries once, then watches API/dashboard/harness and dependencies. No migration or seed.               |
| `pnpm dev:all`                                                                 | Same prerequisites and library watchers, plus web, docs and internal-docs. This selects applications, not another infrastructure provider.                                     |
| `pnpm db:setup`                                                                | Builds db prerequisites, applies committed migrations, provisions local projects and the fixture account through auth. Idempotent; never resets telemetry.                     |
| `pnpm db:seed`                                                                 | Builds db prerequisites and provisions fixtures/account only. Useful after local fixture changes; does not migrate.                                                            |
| `pnpm db:migrate:local`                                                        | Explicit local migration using the same TypeScript CLI and Compose target proof as setup/Studio.                                                                               |
| `pnpm db:generate`                                                             | Generates Drizzle SQL and metadata from schema changes. Does not apply SQL.                                                                                                    |
| `pnpm db:studio`                                                               | Starts the guarded database browser on loopback port 4983. Separate from app startup.                                                                                          |
| `pnpm db:reset-local-telemetry -- --confirm-local-telemetry`                   | Deletes only the operations project's local telemetry. Requires separate user approval; not onboarding or test cleanup.                                                        |
| `pnpm test`                                                                    | Discovers root `scripts/*.test.mjs`, then runs workspace unit tests through Turbo. No configured test target is required.                                                      |
| `pnpm test:integration`                                                        | Owns a unique Compose tmpfs PostgreSQL, builds/migrates/runs db and server suites, checks complete reports, removes only its containers/network. No seed or persistent volume. |
| `pnpm build`                                                                   | Dependency-ordered workspace builds; needed for app artifacts and SDK packaging.                                                                                               |
| `pnpm lint`                                                                    | Workspace ESLint checks.                                                                                                                                                       |
| `pnpm typecheck`                                                               | Workspace type checks with dependency builds.                                                                                                                                  |
| `pnpm format` / `pnpm format:check`                                            | Prettier write/check; different intentional effects.                                                                                                                           |
| `pnpm check`                                                                   | Format, lint, typecheck and unit-test acceptance gate used by CI. Stop dev watchers first.                                                                                     |
| `pnpm db:migrate`                                                              | Shared guarded migration entrypoint for hosted wrappers and the managed integration runner. Daily local work uses the explicitly local command above.                          |
| `pnpm db:migrate:preview` / `pnpm db:migrate:staging` / `pnpm db:migrate:prod` | Distinct hosted approval/branch/host guards, history preflight, migration and history verification. See [rollout](./migrations.md); never folded into local setup.             |
| `pnpm neon:env-pull`                                                           | Pulls ignored operator connection files. Use `-- --preview` or `-- --staging` for those branches; default is Production. Does not provision resources or rewrite app env.      |
| `pnpm release:verify`                                                          | SDK tests/builds, local tarball checks and version agreement; does not publish.                                                                                                |

`--ui=stream` is forwarded to Turbo by either dev command. Agents record
`infra up`'s `container` and `startedByThisCall`; stop with
`pnpm infra down --container <id>` only when they started it. Neither normal
stop nor test cleanup may delete volumes. Unit tests can run without Docker.

## Workspace scripts

These package-local commands support Turbo, root dispatchers or specific app
work. They are not competing local setup procedures.

| Workspace                                                       | Scripts and actual consumers                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/server`, `apps/dashboard`, `apps/dev-harness`, `apps/web` | `dev` runs Next.js bound to loopback; `build` produces the app artifact; `start` serves that artifact for self-hosting; `lint`, `typecheck`, `test` supply Turbo/CI checks. Direct dev requires built dependencies. Harness always binds to loopback.                                                                     |
| `apps/docs`                                                     | Same app/check commands; `prebuild` and `pretypecheck` generate Fumadocs MDX before those operations. Tests verify links, navigation and SDK snippets.                                                                                                                                                                    |
| `apps/internal-docs`                                            | `dev`, `build`, `start`, `lint`, `typecheck` and MDX lifecycle hooks. Renders contributor docs, binds to loopback; never deployed.                                                                                                                                                                                        |
| `packages/core`, `packages/sdk`, `packages/api`                 | `build`, `dev` compiler watcher, `lint`, `typecheck`, `test`. Build output is consumed by app imports, tests and SDK packaging.                                                                                                                                                                                           |
| `packages/auth`                                                 | Same library/check commands, plus `db:setup` and `db:seed` called directly by the root. Owns fixture account provisioning; depends on db without a reverse dependency.                                                                                                                                                    |
| `packages/db`                                                   | Compiler `build` / `dev`, `lint`, `typecheck`, unit `test`; `infra`, `test:integration`, `db:generate`, `db:studio`, `db:migrate`, `db:reset-local-telemetry` implement root commands.                                                                                                                                    |
| `packages/db` operator tools                                    | `db:migrations:verify` verifies committed hashes/timestamps (hosted wrapper preflight/postflight); `db:schema-baseline` supports explicit approved schema-only Preview/Staging adoption; `db:facts:backfill` is bounded local dry-run/apply with project scoping and Compose proof. These have distinct safety contracts. |
| `packages/ui`                                                   | `build`, `lint`, `typecheck`; shared primitives consumed by apps. No redundant test alias.                                                                                                                                                                                                                                |
| `packages/config`                                               | Shared configuration only; no scripts.                                                                                                                                                                                                                                                                                    |
| `infrastructure`                                                | Separate Pulumi pnpm project with `typecheck` and compiled `test`. Resource mutation requires reviewed Pulumi preview/apply approval; local Compose is unrelated.                                                                                                                                                         |

`turbo.json` retains the `dev:ready` build barrier, native watchers and standard
build/check graph. Studio is no longer a Turbo background task. The root pnpm
workspace continues to include `apps/*` and `packages/*`; infrastructure keeps
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
