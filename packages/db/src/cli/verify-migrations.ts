import { readMigrationFiles } from "drizzle-orm/migrator"
import { sql } from "drizzle-orm"
import { Effect } from "effect"
import { loadApiEnvironment } from "../environment/load.js"
import { readMigrationDatabaseUrl } from "../environment/runtime.js"
import { assertMigrationTarget } from "../environment/migration-target.js"
import { CommandConfigurationError } from "../environment/error.js"
import { DatabaseOperation } from "../persistence/database-operation.js"
import { runQuery } from "../persistence/run-query.js"
import { withCommandDatabase } from "./connection.js"
import { runDatabaseCommand } from "./run.js"
import { verifyMigrationHistory } from "./migration-history.js"

await runDatabaseCommand(
  Effect.gen(function* () {
    yield* loadApiEnvironment
    const url = yield* readMigrationDatabaseUrl()
    yield* assertMigrationTarget(url)
    const expected = yield* Effect.try({
      try: () =>
        readMigrationFiles({
          migrationsFolder: new URL("../../migrations", import.meta.url)
            .pathname,
        }),
      catch: () =>
        new CommandConfigurationError({
          reason: "Could not read committed migrations.",
        }),
    })
    const actual = yield* withCommandDatabase(url, (db) =>
      Effect.gen(function* () {
        const present = yield* runQuery(
          DatabaseOperation.VerifyMigrations,
          () =>
            db.execute<{ present: boolean }>(
              sql`select to_regclass('drizzle.__drizzle_migrations') is not null as present`,
            ),
        )
        if (!present[0]?.present) {
          return []
        }
        return yield* runQuery(DatabaseOperation.VerifyMigrations, () =>
          db.execute<{ hash: string; created_at: string }>(
            sql`select hash, created_at from drizzle.__drizzle_migrations order by created_at, id`,
          ),
        )
      }),
    )
    yield* verifyMigrationHistory(
      expected,
      actual,
      process.argv.includes("--allow-pending"),
    )
    yield* Effect.sync(() =>
      console.log(
        `Verified migration history: ${actual.length}/${expected.length} committed migrations applied.`,
      ),
    )
  }),
)
