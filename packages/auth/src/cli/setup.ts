import { Effect } from "effect"
import {
  applyCommittedMigrations,
  loadApiEnvironment,
  readLocalDevelopmentDatabaseUrl,
  runDatabaseCommand,
  seedLocalDevelopment,
} from "@flowmark/db/seed"
import { seedLocalAuthUser } from "../seed-local-user.js"

await runDatabaseCommand(
  Effect.gen(function* () {
    yield* loadApiEnvironment
    const runtimeUrl = yield* readLocalDevelopmentDatabaseUrl()
    yield* applyCommittedMigrations(runtimeUrl)
    yield* seedLocalDevelopment(runtimeUrl, seedLocalAuthUser)
    yield* Effect.sync(() => {
      console.log(
        "Applied committed migrations and provisioned local development projects. Development-only keys are documented in the development guide.",
      )
    })
  }),
)
