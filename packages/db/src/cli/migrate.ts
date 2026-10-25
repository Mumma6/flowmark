import { Effect } from "effect"
import { loadApiEnvironment } from "../environment/load.js"
import { readMigrationDatabaseUrl } from "../environment/runtime.js"
import { applyCommittedMigrations } from "./apply-migrations.js"
import { runDatabaseCommand } from "./run.js"

await runDatabaseCommand(
  Effect.gen(function* () {
    yield* loadApiEnvironment
    const url = yield* readMigrationDatabaseUrl()
    yield* applyCommittedMigrations(url)
    yield* Effect.sync(() => {
      console.log("Applied committed Flowmark migrations.")
    })
  }),
)
