import { Effect } from "effect"
import { createDatabase } from "@flowmark/db"
import { createFlowmarkAuth, readAuthSecret } from "@flowmark/db/auth"
import {
  assertPreviewAuthOrigins,
  assertPreviewDatabase,
  previewDashboardOrigin,
} from "@flowmark/db/environment"
import { ConfigurationError } from "@flowmark/api"

let cached: ReturnType<typeof createFlowmarkAuth> | undefined

export const getAuth = Effect.fn("getAuth")(function* () {
  if (cached) {
    return cached
  }
  const configuredUrl = process.env.DATABASE_URL
  const previewOrigin = previewDashboardOrigin()
  const dashboardOrigin =
    previewOrigin ??
    process.env.FLOWMARK_DASHBOARD_ORIGIN ??
    "http://localhost:3001"
  const baseURL =
    previewOrigin ?? process.env.BETTER_AUTH_URL ?? dashboardOrigin
  const url = yield* Effect.gen(function* () {
    yield* assertPreviewAuthOrigins({
      ...process.env,
      BETTER_AUTH_URL: baseURL,
      FLOWMARK_DASHBOARD_ORIGIN: dashboardOrigin,
    })
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
    baseURL,
    trustedOrigins: [dashboardOrigin],
  })
  return cached
})
