import { Effect } from "effect"
import {
  applyCommittedMigrations,
  assertLocalDevelopmentDatabase,
  loadApiEnvironment,
  readDatabaseUrl,
  readMigrationDatabaseUrl,
  runDatabaseCommand,
  seedLocalDevelopment,
} from "@flowmark/db/seed"
import { seedLocalAuthUser } from "../seed-local-user.js"

await runDatabaseCommand(
  Effect.gen(function* () {
    yield* loadApiEnvironment
    const runtimeUrl = yield* readDatabaseUrl()
    yield* assertLocalDevelopmentDatabase(runtimeUrl)
    const migrationUrl = yield* readMigrationDatabaseUrl()
    yield* assertLocalDevelopmentDatabase(migrationUrl)
    yield* applyCommittedMigrations(migrationUrl)
    yield* seedLocalDevelopment(runtimeUrl, seedLocalAuthUser)
    yield* Effect.sync(() => {
      console.log(
        "Applied committed migrations and provisioned local development projects. Development-only keys are documented in the development guide.",
      )
    })
  }),
)
