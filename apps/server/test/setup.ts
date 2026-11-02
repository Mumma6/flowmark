import { Effect, Result } from "effect"
import { validateOptionalTestDatabase } from "@flowmark/db/test-environment"

export default async function setup() {
  Result.match(
    await Effect.runPromise(Effect.result(validateOptionalTestDatabase())),
    {
      onFailure: (error) => {
        throw new Error(error.reason)
      },
      onSuccess: () => undefined,
    },
  )
}
