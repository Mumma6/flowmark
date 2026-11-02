# @flowmark/db

PostgreSQL schema, Drizzle migrations, and Effect persistence services for
Flowmark. API code talks to repository ports. SQL stays in this package.
Better Auth configuration lives in `@flowmark/auth`. This package keeps the
auth tables and the atomic limiter write, exposed as `@flowmark/db/auth-limits`.
`@flowmark/db/seed` exposes local project provisioning for the auth commands.
It does not depend on `@flowmark/auth`. Root `pnpm db:seed` and `pnpm db:setup` call the auth package directly.

Committed migrations live in `migrations/`. Generate a new migration with
`pnpm db:generate` from the repository root, and ship the schema, SQL, and
Drizzle metadata with the code that needs them. Do not edit a migration that
has already been applied.

```sh
pnpm db:migrate:local
pnpm db:setup
pnpm --filter @flowmark/db test
```

`pnpm db:setup` and `pnpm db:seed` are for a loopback demo database. They refuse
hosted targets. Rollout order, Preview, Staging, and Production commands are in
[database rollout](../../docs/migrations.md).
Setup/seed build db and its transitive workspace dependencies. Setup requires
any migration override to match the runtime host, port, database, and role,
then migrates and seeds using `DATABASE_URL`.

Local infrastructure is checkout-scoped PostgreSQL 18 through Docker Compose.
Use `pnpm infra <operation>` for startup, diagnostics and non-destructive stop.
Every local database command verifies Compose ownership and rejects unmanaged
or hosted targets. Existing env files/data are preserved; see
[local infrastructure](../../docs/development.md#local-postgresql-with-compose)
and [existing local data](../../docs/development.md#existing-local-data).

From the repository root, `pnpm test:integration` builds API/auth dependencies,
migrates a fresh run-scoped PostgreSQL 18 instance, runs db/server tests and
checks both reports for missing or skipped integration coverage. Test data lives
in tmpfs, with an allocated IPv4 loopback port and no persistent volumes.
The runner removes only its own containers/network, including after normal
interruptions, and prints a directory containing reports and ownership metadata.
It refuses ambient database URLs and hosted migration authorization.

`pnpm --filter @flowmark/db test` discovers `test/**/*.test.ts` without a manually
maintained file list. Its preload validates any configured test target before
fixtures can write; server tests use the same guard. Without
`TEST_DATABASE_URL`, normal unit checks skip the three database cases and need
no Docker. For database coverage, use the managed root integration command;
arbitrary manually selected test databases are refused. CI keeps its declared
Actions service and uses the same check sequence through `--ci-service`.
See [integration tests](../../docs/development.md#database-integration-tests)
for reports, concurrency and recovery guidance.

`pnpm db:studio` uses `drizzle.studio.config.ts`: a guarded local-demo config
that selects the runtime database and refuses conflicting migration overrides,
hosted targets, and production mode before startup. The shared
`drizzle.config.ts` retains migration-URL precedence for migration tooling.

Cloud branches/computes/roles and hosted connection bindings follow the
[Pulumi writer policy](../../docs/infrastructure.md#pulumi-is-the-infrastructure-writer),
including temporary cloud branches. Drizzle retains schema/history ownership.
