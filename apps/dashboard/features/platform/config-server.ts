import {
  assertPreviewDashboardApi,
  previewApiOrigin,
} from "@flowmark/db/environment"
import { Context, Data, Effect, Layer, Schema, Option, pipe } from "effect"
import "server-only"

export class DashboardConfigurationError extends Data.TaggedError(
  "DashboardConfigurationError",
)<{
  readonly reason: string
}> {}

const isProductionRuntime = () =>
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL_ENV === "production"

const isPreviewRuntime = () => process.env.VERCEL_ENV === "preview"

export const dashboardApiUrl = Effect.fn("dashboardApiUrl")(function* () {
  const configured = process.env.FLOWMARK_API_URL
  const sibling = previewApiOrigin()
  const candidate = isPreviewRuntime() ? (sibling ?? configured) : configured
  yield* assertPreviewDashboardApi(candidate).pipe(
    Effect.catchTags({
      PreviewDashboardApiError: (error) =>
        Effect.fail(new DashboardConfigurationError({ reason: error.reason })),
    }),
  )
  if (candidate) {
    yield* Schema.decodeUnknownEffect(
      Schema.String.pipe(
        Schema.check(
          Schema.makeFilter((value) => {
            return pipe(
              Option.liftThrowable((candidate: string) => new URL(candidate))(
                value,
              ),
              Option.filter(
                (url) =>
                  ["http:", "https:"].includes(url.protocol) &&
                  !url.username &&
                  !url.password &&
                  !url.search &&
                  !url.hash,
              ),
              Option.isSome,
            )
          }),
        ),
      ),
    )(candidate).pipe(
      Effect.mapError(
        () =>
          new DashboardConfigurationError({
            reason:
              "FLOWMARK_API_URL must be an HTTP(S) URL without credentials, query, or fragment.",
          }),
      ),
    )
    return candidate
  }
  if (isProductionRuntime()) {
    return yield* new DashboardConfigurationError({
      reason: "FLOWMARK_API_URL is required in production.",
    })
  }
  return "http://localhost:3003"
})

export const dashboardDemoModeEnabled = Effect.fn("dashboardDemoModeEnabled")(
  function* () {
    const enabled = process.env.FLOWMARK_DEMO_MODE === "true"
    if (enabled && isProductionRuntime()) {
      return yield* new DashboardConfigurationError({
        reason: "FLOWMARK_DEMO_MODE cannot be enabled in production.",
      })
    }
    if (enabled && isPreviewRuntime()) {
      return yield* new DashboardConfigurationError({
        reason: "FLOWMARK_DEMO_MODE cannot be enabled in preview.",
      })
    }
    return enabled
  },
)

export const localDevelopmentAccount = () =>
  process.env.NODE_ENV !== "production" && !process.env.VERCEL_ENV
    ? { email: "local@flowmark.test", password: "local-dev-only" }
    : undefined

export class DashboardServerConfig extends Context.Service<
  DashboardServerConfig,
  {
    readonly apiUrl: string
    readonly protectionBypass: string | undefined
  }
>()("@flowmark/dashboard/DashboardServerConfig") {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const apiUrl = yield* dashboardApiUrl()
      return DashboardServerConfig.of({
        apiUrl: apiUrl.endsWith("/") ? apiUrl : `${apiUrl}/`,
        protectionBypass: process.env.FLOWMARK_VERCEL_PROTECTION_BYPASS,
      })
    }),
  )
}
