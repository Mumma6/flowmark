import { Effect } from "effect"
import { loadApiEnvironment } from "../environment/load.js"
import {
  isLoopbackDatabaseUrl,
  readMigrationDatabaseUrl,
} from "../environment/runtime.js"
import { assertManagedLocalDatabase } from "../environment/managed-local-database.js"
import { assertMigrationTarget } from "../environment/migration-target.js"
import { applyCommittedMigrations } from "./apply-migrations.js"
import { runDatabaseCommand } from "./run.js"

await runDatabaseCommand(
  Effect.gen(function* () {
    yield* loadApiEnvironment
    const url = yield* readMigrationDatabaseUrl()
    yield* assertMigrationTarget(url)
    if (isLoopbackDatabaseUrl(url)) {
      yield* assertManagedLocalDatabase(url)
    }
    yield* applyCommittedMigrations(url)
    yield* Effect.sync(() => {
      console.log("Applied committed Flowmark migrations.")
    })
  }),
)
