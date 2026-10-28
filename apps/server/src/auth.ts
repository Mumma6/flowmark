import { Effect } from "effect"
import { createDatabase } from "@flowmark/db"
import { createFlowmarkAuth, readAuthSecret } from "@flowmark/db/auth"
import {
  assertPreviewAuthOrigins,
  assertPreviewDatabase,
} from "@flowmark/db/environment"
import { ConfigurationError } from "@flowmark/api"

let cached: ReturnType<typeof createFlowmarkAuth> | undefined

export const getAuth = Effect.fn("getAuth")(function* () {
  if (cached) {
    return cached
  }
  const configuredUrl = process.env.DATABASE_URL
  const url = yield* Effect.gen(function* () {
    yield* assertPreviewAuthOrigins()
    if (!configuredUrl) {
      return yield* new ConfigurationError({
        cause: new Error("DATABASE_URL is required for authentication."),
      })
    }
    yield* assertPreviewDatabase(configuredUrl)
    return configuredUrl
  }).pipe(
    Effect.catchTags({
      PreviewAuthOriginError: (error) =>
        Effect.fail(new ConfigurationError({ cause: error })),
      PreviewDatabaseError: (error) =>
        Effect.fail(new ConfigurationError({ cause: error })),
    }),
  )
  const secret = yield* readAuthSecret().pipe(
    Effect.catchTag("AuthConfigurationError", (error) =>
      Effect.fail(new ConfigurationError({ cause: error })),
    ),
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
