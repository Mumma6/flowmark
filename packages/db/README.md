# @flowmark/db

PostgreSQL schema, Drizzle migrations, and Effect persistence services for
Flowmark. API code talks to repository ports. SQL stays in this package.
Better Auth configuration lives in `@flowmark/auth`. This package keeps the
auth tables and the atomic limiter write, exposed as `@flowmark/db/auth-limits`.
`@flowmark/db/seed` exposes local project provisioning for the auth commands.
It does not depend on `@flowmark/auth`. `pnpm db:seed` and `pnpm db:setup` in
this package delegate to those auth commands.

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

`pnpm db:studio` uses `drizzle.studio.config.ts`: a guarded local-demo config
that selects the runtime database and refuses conflicting migration overrides,
hosted targets, and production mode before startup. The shared
`drizzle.config.ts` retains migration-URL precedence for migration tooling.

Cloud branches/computes/roles and hosted connection bindings follow the
[Pulumi writer policy](../../docs/infrastructure.md#pulumi-is-the-infrastructure-writer),
including temporary cloud branches. Drizzle retains schema/history ownership.
