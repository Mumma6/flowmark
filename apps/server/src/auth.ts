import { Effect } from "effect"
import { createDatabase } from "@flowmark/db"
import { createFlowmarkAuth, readAuthSecret } from "@flowmark/db/auth"
import { assertPreviewDatabase } from "@flowmark/db/environment"
import { ConfigurationError } from "@flowmark/api"

import { serverOrigins } from "./server-env"

let cached: ReturnType<typeof createFlowmarkAuth> | undefined

export const getAuth = Effect.fn("getAuth")(function* () {
  if (cached) {
    return cached
  }
  const configuredUrl = process.env.DATABASE_URL
  const { dashboardOrigin, baseURL } = yield* serverOrigins().pipe(
    Effect.mapError((error) => new ConfigurationError({ cause: error })),
  )
  const url = yield* Effect.gen(function* () {
    if (!configuredUrl) {
      return yield* new ConfigurationError({
        cause: new Error("DATABASE_URL is required for authentication."),
      })
    }
    yield* assertPreviewDatabase(configuredUrl)
    return configuredUrl
  }).pipe(
    Effect.catchTags({
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
    baseURL,
    trustedOrigins: [dashboardOrigin],
  })
  return cached
})
