import { defineConfig } from "drizzle-kit"
import { Effect, Result } from "effect"
import { loadApiEnvironment } from "./src/environment/load"
import { readLocalDevelopmentDatabaseUrl } from "./src/environment/local-database"

const url = Result.match(
  Effect.runSync(
    Effect.result(
      Effect.gen(function* () {
        yield* loadApiEnvironment
        return yield* readLocalDevelopmentDatabaseUrl()
      }),
    ),
  ),
  {
    // Drizzle Kit renders Error.message rather than the tagged error's reason.
    onFailure: (error) => {
      throw new Error(error.reason)
    },
    onSuccess: (url) => url,
  },
)

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url },
})
