import { Effect } from "effect"
import { createDatabase } from "@flowmark/db"
import { createFlowmarkAuth, readAuthSecret } from "@flowmark/db/auth"
import { ConfigurationError } from "@flowmark/api"

let cached: ReturnType<typeof createFlowmarkAuth> | undefined

export const getAuth = Effect.fn("getAuth")(function* () {
  if (cached) {
    return cached
  }
  const url = process.env.DATABASE_URL
  if (!url) {
    return yield* new ConfigurationError({
      cause: new Error("DATABASE_URL is required for authentication."),
    })
  }
  const secret = yield* readAuthSecret().pipe(
    Effect.mapError((error) => new ConfigurationError({ cause: error })),
  )
  const { db } = createDatabase(url)
  cached = createFlowmarkAuth({
    db,
    secret,
    baseURL:
      process.env.BETTER_AUTH_URL ??
      process.env.FLOWMARK_DASHBOARD_ORIGIN ??
      "http://localhost:3001",
    trustedOrigins: [
      process.env.FLOWMARK_DASHBOARD_ORIGIN ?? "http://localhost:3001",
    ],
  })
  return cached
})
