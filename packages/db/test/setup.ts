import { Effect, Result } from "effect"
import { validateOptionalTestDatabase } from "../src/environment/test-database.js"

Result.match(
  await Effect.runPromise(Effect.result(validateOptionalTestDatabase())),
  {
    onFailure: (error) => {
      throw new Error(error.reason)
    },
    onSuccess: () => undefined,
  },
)
