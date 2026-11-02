import { Effect } from "effect"
import { loadApiEnvironment } from "../environment/load.js"
import { readCheckedMigrationDatabaseUrl } from "../environment/migration-database.js"
import { applyCommittedMigrations } from "./apply-migrations.js"
import { runDatabaseCommand } from "./run.js"

await runDatabaseCommand(
  Effect.gen(function* () {
    yield* loadApiEnvironment
    const url = yield* readCheckedMigrationDatabaseUrl(
      process.argv.includes("--local"),
    )
    yield* applyCommittedMigrations(url)
    yield* Effect.sync(() => {
      console.log("Applied committed Flowmark migrations.")
    })
  }),
)
