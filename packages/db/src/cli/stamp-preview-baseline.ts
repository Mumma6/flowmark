import { readFileSync } from "node:fs"
import { join } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { Effect, Match, Option } from "effect"
import postgres from "postgres"
import { PreviewBaselineError } from "../environment/error.js"
import {
  committedMigrationHash,
  decidePreviewBaseline,
  type PreviewBaselineState,
} from "../environment/preview-baseline.js"
import { DatabaseError } from "../persistence/database.js"
import { DatabaseOperation } from "../persistence/database-operation.js"
import { runDatabaseCommand } from "./run.js"

const migrationsFolder = fileURLToPath(
  new URL("../../migrations", import.meta.url),
)

const assertPreviewBaselineTarget = Effect.fn("assertPreviewBaselineTarget")(
  function* (env: NodeJS.ProcessEnv = process.env) {
    if (env.NEON_BRANCH !== "preview") {
      return yield* new PreviewBaselineError({
        reason: `Refusing preview baseline: NEON_BRANCH is "${env.NEON_BRANCH ?? ""}", not preview.`,
      })
    }
    if (env.FLOWMARK_DEMO_MODE === "true") {
      return yield* new PreviewBaselineError({
        reason: "Refusing preview baseline while FLOWMARK_DEMO_MODE is true.",
      })
    }
    const url = env.DATABASE_MIGRATION_URL
    if (!url) {
      return yield* new PreviewBaselineError({
        reason:
          "Refusing preview baseline: DATABASE_MIGRATION_URL is required.",
      })
    }
    const host = yield* Effect.try({
      try: () => new URL(url).hostname,
      catch: () =>
        new PreviewBaselineError({
          reason:
            "Refusing preview baseline: DATABASE_MIGRATION_URL is not a valid URL.",
        }),
    })
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      !host.endsWith(".neon.tech")
    ) {
      return yield* new PreviewBaselineError({
        reason: `Refusing preview baseline: host ${host} is not a Neon host.`,
      })
    }
    if (
      env.FLOWMARK_PRODUCTION_DATABASE_HOST &&
      host === env.FLOWMARK_PRODUCTION_DATABASE_HOST
    ) {
      return yield* new PreviewBaselineError({
        reason: `Refusing preview baseline: host ${host} matches the production env file.`,
      })
    }
    return url
  },
)

const relationExists = (sql: postgres.Sql, relation: string) =>
  Effect.tryPromise({
    try: () =>
      sql<{ name: string | null }[]>`
        select to_regclass(${relation}) as name
      `,
    catch: (cause) =>
      new DatabaseError({ operation: DatabaseOperation.Migrate, cause }),
  }).pipe(Effect.map((rows) => rows[0]?.name != null))

const rowCount = (
  sql: postgres.Sql,
  table: "user" | "workflows" | "migrations",
) =>
  Effect.tryPromise({
    try: () =>
      Match.value(table).pipe(
        Match.when(
          "user",
          () =>
            sql<{ count: number }[]>`
              select count(*)::int as count from "user"
            `,
        ),
        Match.when(
          "workflows",
          () =>
            sql<{ count: number }[]>`
              select count(*)::int as count from workflows
            `,
        ),
        Match.when(
          "migrations",
          () =>
            sql<{ count: number }[]>`
              select count(*)::int as count from drizzle.__drizzle_migrations
            `,
        ),
        Match.exhaustive,
      ),
    catch: (cause) =>
      new DatabaseError({ operation: DatabaseOperation.Migrate, cause }),
  }).pipe(Effect.map((rows) => Number(rows[0]?.count ?? 0)))

const readMigrationEntries = Effect.fn("readMigrationEntries")(function* () {
  const journal = yield* Effect.try({
    try: () =>
      JSON.parse(
        readFileSync(join(migrationsFolder, "meta/_journal.json"), "utf8"),
      ) as {
        readonly entries: ReadonlyArray<{
          readonly tag: string
          readonly when: number
        }>
      },
    catch: (cause) =>
      new DatabaseError({ operation: DatabaseOperation.Migrate, cause }),
  })
  return yield* Effect.forEach(journal.entries, (entry) =>
    Effect.try({
      try: () => ({
        hash: committedMigrationHash(
          readFileSync(join(migrationsFolder, `${entry.tag}.sql`), "utf8"),
        ),
        createdAt: entry.when,
      }),
      catch: (cause) =>
        new DatabaseError({ operation: DatabaseOperation.Migrate, cause }),
    }),
  )
})

const stampEntries = (sql: postgres.Sql) =>
  Effect.gen(function* () {
    const entries = yield* readMigrationEntries()
    yield* Effect.tryPromise({
      try: () => sql`create schema if not exists drizzle`,
      catch: (cause) =>
        new DatabaseError({ operation: DatabaseOperation.Migrate, cause }),
    })
    yield* Effect.tryPromise({
      try: () => sql`
        create table if not exists drizzle.__drizzle_migrations (
          id serial primary key,
          hash text not null,
          created_at bigint
        )
      `,
      catch: (cause) =>
        new DatabaseError({ operation: DatabaseOperation.Migrate, cause }),
    })
    yield* Effect.forEach(
      entries,
      (entry) =>
        Effect.tryPromise({
          try: () => sql`
            insert into drizzle.__drizzle_migrations (hash, created_at)
            values (${entry.hash}, ${entry.createdAt})
          `,
          catch: (cause) =>
            new DatabaseError({ operation: DatabaseOperation.Migrate, cause }),
        }),
      { concurrency: 1 },
    )
    return `Stamped ${entries.length} committed migrations on the preview branch. No product rows were copied.`
  })

const inspectPreviewBaseline = (sql: postgres.Sql) =>
  Effect.gen(function* () {
    const userTableExists = yield* relationExists(sql, "public.user")
    const workflowsTableExists = yield* relationExists(sql, "public.workflows")
    const migrationTableExists = yield* relationExists(
      sql,
      "drizzle.__drizzle_migrations",
    )
    const state: PreviewBaselineState = {
      userTableExists,
      workflowsTableExists,
      userRowCount: userTableExists ? yield* rowCount(sql, "user") : 0,
      workflowRowCount: workflowsTableExists
        ? yield* rowCount(sql, "workflows")
        : 0,
      migrationRowCount: migrationTableExists
        ? yield* rowCount(sql, "migrations")
        : 0,
    }
    const skipped = yield* decidePreviewBaseline(state)
    return yield* Option.match(skipped, {
      onNone: () => stampEntries(sql),
      onSome: (reason) => Effect.succeed(reason),
    })
  })

const withPreviewSql = <A, E>(
  url: string,
  use: (sql: postgres.Sql) => Effect.Effect<A, E>,
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const sql = yield* Effect.acquireRelease(
        Effect.try({
          try: () => postgres(url, { prepare: false, max: 1 }),
          catch: (cause) =>
            new DatabaseError({
              operation: DatabaseOperation.Connect,
              cause,
            }),
        }),
        (client) =>
          Effect.tryPromise({
            try: () => client.end(),
            catch: (cause) =>
              new DatabaseError({
                operation: DatabaseOperation.Close,
                cause,
              }),
          }).pipe(Effect.orDie),
      )
      return yield* use(sql)
    }),
  )

await runDatabaseCommand(
  Effect.gen(function* () {
    const url = yield* assertPreviewBaselineTarget()
    const message = yield* withPreviewSql(url, inspectPreviewBaseline)
    yield* Effect.sync(() => {
      console.log(message)
    })
  }),
)
