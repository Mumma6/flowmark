import { Effect } from "effect"
import { loadApiEnvironment } from "../environment/load.js"
import {
  assertLocalDevelopmentDatabase,
  readDatabaseUrl,
  readMigrationDatabaseUrl,
} from "../environment/runtime.js"
import { applyCommittedMigrations } from "./apply-migrations.js"
import { runDatabaseCommand } from "./run.js"
import { seedLocalDevelopment } from "./seed-local-development.js"

await runDatabaseCommand(
  Effect.gen(function* () {
    yield* loadApiEnvironment
    const runtimeUrl = yield* readDatabaseUrl()
    yield* assertLocalDevelopmentDatabase(runtimeUrl)
    const migrationUrl = yield* readMigrationDatabaseUrl()
    yield* assertLocalDevelopmentDatabase(migrationUrl)
    yield* applyCommittedMigrations(migrationUrl)
    yield* seedLocalDevelopment(runtimeUrl)
    yield* Effect.sync(() => {
      console.log(
        "Applied committed migrations and provisioned local development projects. Development-only keys are documented in the development guide.",
      )
    })
  }),
)
