---
name: flowmark-persistence
description: "Use when adding or refactoring Flowmark database, Drizzle, SQL, query, migration, seed, or @flowmark/db persistence code. Organize packages/db by schema, persistence services, CLI, and environment; split feature folders into queries, writes, and sql; use Effect.Service stores and DatabaseOperation instead of free operation strings."
---

# Flowmark Persistence

Apply this skill when changing `packages/db` or the API adapters that consume
it. Read [flowmark-architecture](../flowmark-architecture/SKILL.md) first for
Effect, ports, and package boundaries. This skill owns the db package layout
and naming.

Call the layer **persistence**, not store. `@flowmark/db/persistence` is the
public entry. `WorkflowStore` / `ProjectCredentialsStore` are service names
for data access, not a reason to revive a `store/` folder.

## Package layout

```text
packages/db/src/
  index.ts                 # createDatabase + schema re-exports
  client.ts                # Drizzle client factory
  schema/                  # tables only
  fixtures/                # local demo keys and IDs
  environment/             # env load, runtime guards, command config errors
  cli/                     # migrate, seed, setup, reset, process runner
  persistence/
    database.ts            # Database tag, DatabaseError, provideDatabase
    database-operation.ts  # enum of every DatabaseError operation
    run-query.ts           # Promise/Drizzle boundary
    workflows/
      workflow-store.ts
      types.ts
      queries/             # reads: get-*.ts
      writes/              # inserts, updates, transactions
      sql/                 # raw SQL fragments only
    project-access/
      project-credentials-store.ts
      queries/
      writes/
```

- Keep SQL, schema, transactions, and driver lifecycle inside `@flowmark/db`.
- Keep CLI process entrypoints out of `persistence/`. Seed and reset may use
  `DatabaseError` / `DatabaseOperation`, but they are not store methods.
- Do not import `createDatabase` through the package root from persistence
  internals; use `client.ts` to avoid cycles.
- Preserve `@flowmark/db`, `@flowmark/db/schema`, `@flowmark/db/persistence`,
  and `@flowmark/db/demo` when moving files.

## Feature folders

Group by domain (`workflows`, `project-access`), then by kind:

| Folder | Put here | Name like |
| --- | --- | --- |
| `queries/` | Reads that return rows or read models | `get-project-snapshot.ts` |
| `writes/` | Inserts, updates, transactions | `append-event.ts` |
| `sql/` | Shared SQL fragments, no Effect | `run-summaries.ts` |

- One primary query, write, or service per file.
- `get-*` for reads. Imperative domain verbs for writes
  (`append-event`, `consume-browser-quota`).
- Do not suffix files with `-sql` when they already live in `sql/`.
- Do not leave raw SQL inside a query file when another query reuses it.
- Pure field mapping stays next to the write that uses it
  (`writes/event-fields.ts`).
- The `*Store` file only wires `Effect.Service` methods to queries/writes.

## Effect services

```ts
export class WorkflowStore extends Effect.Service<WorkflowStore>()(
  "@flowmark/db/WorkflowStore",
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const provide = provideDatabase(yield* Database)
      return {
        snapshot: (projectId) => provide(getProjectSnapshot(projectId)),
      } satisfies WorkflowStoreService
    }),
  },
) {}
```

- Declare a small service interface; `satisfies` it in `Effect.Service`.
- Provide `Database` inside the store so API adapters see `R = never`.
- Compose `WorkflowStore.Default` / `ProjectCredentialsStore.Default` in
  `packages/api` with `DatabaseLive`.
- Adapters `yield*` the store and map `DatabaseError` / `MissingRunError` to
  API errors. They must not run SQL.

## Queries and operations

- Wrap every Drizzle/driver Promise with `runQuery(DatabaseOperation.X, ...)`.
- `runQuery` accepts `DatabaseOperation` only. Never pass a free string.
- Add a new enum member before introducing a new operation. Use the same enum
  for connect, close, migrate, seed, and reset.
- Name `Effect.fn` after the exported function (`getProjectSnapshot`).
- Keep last-reported status semantics: failed wins over completed; missing
  terminal events stay Running. Do not change SQL meaning to tidy files.
- Every read and write stays project-scoped.

## Required migration workflow

A database-backed change is not complete when the schema and migration file
exist only in Git. Every committed schema migration must be applied and
verified in both database environments:

1. Generate the migration from the schema change and inspect the SQL. Never
   edit an already-applied migration; create a new migration instead.
2. Apply the committed migration to the local loopback database:
   `pnpm db:migrate`. The CLI loads `apps/server/.env.local`; it must not
   point the local demo at Neon.
3. Apply the same committed migration to the Neon `production` branch using
   the secure migration connection (`DATABASE_MIGRATION_URL`), from a
   workstation. Do not put the URL in Git, chat, or a Vercel runtime env.
4. Verify the changed tables/constraints and Drizzle migration history in both
   environments. The migration command must update Drizzle's bookkeeping; do
   not apply raw SQL and leave the migration unrecorded.
5. Run the narrow database/API tests, typecheck, and lint. If either database
   cannot be migrated, stop and report that as an incomplete implementation;
   do not claim the schema change is finished.

Schema migrations run separately from Vercel builds and requests. A migration
does not authorize seeding, resetting telemetry, deleting data, or restoring a
database. Never seed Neon; local fixture setup remains an explicit,
separate operation.

## Adding work

1. Inspect the neighboring query, write, or store before adding a file.
2. New read → `queries/get-<thing>.ts`. Shared SQL → `sql/`. Write → `writes/`.
3. Register the operation on `DatabaseOperation` and thread it through
   `runQuery` or `new DatabaseError({ operation, cause })`.
4. Expose behavior through the feature store unless a test already imports the
   function from `@flowmark/db/persistence`.
5. Update the persistence barrel and any docs that name the old path.
6. Follow the required migration workflow above, then run the narrow
   `@flowmark/db` and `@flowmark/api` typecheck, lint, and tests.
