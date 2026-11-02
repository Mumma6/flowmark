import { Effect } from "effect"
import {
  assertLocalDevelopmentDatabase,
  loadApiEnvironment,
  readDatabaseUrl,
  runDatabaseCommand,
  seedLocalDevelopment,
} from "@flowmark/db/seed"
import { seedLocalAuthUser } from "../seed-local-user.js"

await runDatabaseCommand(
  Effect.gen(function* () {
    yield* loadApiEnvironment
    const url = yield* readDatabaseUrl()
    yield* assertLocalDevelopmentDatabase(url)
    yield* seedLocalDevelopment(url, seedLocalAuthUser)
    yield* Effect.sync(() => {
      console.log(
        "Local development project provisioned. Development-only keys are documented in the development guide.",
      )
    })
  }),
)
