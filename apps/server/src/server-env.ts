import { Data, Effect, Schema } from "effect"
import {
  assertPreviewAuthOrigins,
  previewDashboardOrigin,
} from "@flowmark/db/environment"

export class ServerConfigurationError extends Data.TaggedError(
  "ServerConfigurationError",
)<{ readonly reason: string }> {}

const HttpOrigin = Schema.String.pipe(
  Schema.filter((value) => {
    try {
      const url = new URL(value)
      return (
        (url.protocol === "https:" || url.protocol === "http:") &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        url.pathname === "/"
      )
    } catch {
      return false
    }
  }),
)

const readOrigin = Effect.fn("readOrigin")(function* (
  name: string,
  value: string | undefined,
) {
  if (!value?.trim()) {
    return yield* new ServerConfigurationError({
      reason: `${name} is required in hosted environments.`,
    })
  }
  yield* Schema.decodeUnknown(HttpOrigin)(value).pipe(
    Effect.mapError(
      () =>
        new ServerConfigurationError({
          reason: `${name} must be an HTTP(S) origin without credentials, path, query, or fragment.`,
        }),
    ),
  )
  return new URL(value).origin
})

// Read at the request boundary, never while Next.js imports route modules.
export const serverOrigins = Effect.fn("serverOrigins")(function* (
  env: NodeJS.ProcessEnv = process.env,
) {
  const hosted =
    env.NODE_ENV === "production" ||
    env.VERCEL_ENV === "production" ||
    env.VERCEL_ENV === "preview"
  const preview = previewDashboardOrigin(env)
  const dashboardOrigin = yield* readOrigin(
    "FLOWMARK_DASHBOARD_ORIGIN",
    preview ??
      env.FLOWMARK_DASHBOARD_ORIGIN ??
      (hosted ? undefined : "http://localhost:3001"),
  )
  const baseURL = yield* readOrigin(
    "BETTER_AUTH_URL",
    preview ?? env.BETTER_AUTH_URL ?? (hosted ? undefined : dashboardOrigin),
  )
  yield* assertPreviewAuthOrigins({
    ...env,
    BETTER_AUTH_URL: baseURL,
    FLOWMARK_DASHBOARD_ORIGIN: dashboardOrigin,
  }).pipe(
    Effect.mapError(
      (error) => new ServerConfigurationError({ reason: error.reason }),
    ),
  )
  return { dashboardOrigin, baseURL }
})
