# @flowmark/db

PostgreSQL schema, Drizzle migrations, and Effect persistence services for
Flowmark. API code talks to repository ports. SQL stays in this package.

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
