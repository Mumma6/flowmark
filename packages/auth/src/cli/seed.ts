import { Effect } from "effect"
import {
  loadApiEnvironment,
  readLocalDevelopmentDatabaseUrl,
  runDatabaseCommand,
  seedLocalDevelopment,
} from "@flowmark/db/seed"
import { seedLocalAuthUser } from "../seed-local-user.js"

await runDatabaseCommand(
  Effect.gen(function* () {
    yield* loadApiEnvironment
    const url = yield* readLocalDevelopmentDatabaseUrl()
    yield* seedLocalDevelopment(url, seedLocalAuthUser)
    yield* Effect.sync(() => {
      console.log(
        "Local development project provisioned. Development-only keys are documented in the development guide.",
      )
    })
  }),
)
