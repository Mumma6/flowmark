import { Effect } from "effect"
import { loadApiEnvironment } from "../environment/load.js"
import {
  assertLocalDevelopmentDatabase,
  readDatabaseUrl,
} from "../environment/runtime.js"
import { runDatabaseCommand } from "./run.js"
import { seedLocalDevelopment } from "./seed-local-development.js"

await runDatabaseCommand(
  Effect.gen(function* () {
    yield* loadApiEnvironment
    const url = yield* readDatabaseUrl()
    yield* assertLocalDevelopmentDatabase(url)
    yield* seedLocalDevelopment(url)
    yield* Effect.sync(() => {
      console.log(
        "Local development project provisioned. Development-only keys are documented in the development guide.",
      )
    })
  }),
)
