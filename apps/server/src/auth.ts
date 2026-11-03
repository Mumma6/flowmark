import { after } from "next/server"
import { Email, resendLayer } from "@flowmark/email"
import { Data, Effect, Exit } from "effect"
import { createDatabase } from "@flowmark/db"
import { createFlowmarkAuth, readAuthSecret } from "@flowmark/auth"
import { assertPreviewDatabase } from "@flowmark/db/environment"
import { ConfigurationError } from "@flowmark/api"

import { serverOrigins } from "./server-env"

class AuthEmailTaskError extends Data.TaggedError("AuthEmailTaskError") {}

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
  const emailDelivery = yield* Effect.gen(function* () {
    const configured = [
      "RESEND_API_KEY",
      "FLOWMARK_EMAIL_FROM",
      "FLOWMARK_EMAIL_REPLY_TO",
      "FLOWMARK_EMAIL_ENVIRONMENT",
    ].some((name) => Boolean(process.env[name]?.trim()))
    if (!configured) {
      return undefined
    }
    return yield* Email.pipe(
      Effect.provide(resendLayer({ ...process.env, BETTER_AUTH_URL: baseURL })),
      Effect.mapError((cause) => new ConfigurationError({ cause })),
    )
  })
  const { db } = createDatabase(url)
  cached = createFlowmarkAuth({
    db,
    secret,
    baseURL,
    trustedOrigins: [dashboardOrigin],
    emailDelivery,
    scheduleEmail: (task) => {
      // Attach rejection handling immediately; Next owns the remaining lifetime.
      const result = Effect.runPromiseExit(
        Effect.tryPromise({
          try: () => task,
          catch: () => new AuthEmailTaskError(),
        }),
      )
      after(async () => {
        if (Exit.isFailure(await result)) {
          console.error("[Flowmark auth] Email delivery failed", {
            operation: "email-delivery",
          })
        }
      })
    },
  })
  return cached
})
