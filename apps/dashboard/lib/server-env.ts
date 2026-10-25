import { Data, Effect } from "effect"

export class DashboardConfigurationError extends Data.TaggedError(
  "DashboardConfigurationError",
)<{
  readonly reason: string
}> {}

const isProductionRuntime = () =>
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL_ENV === "production"

export const dashboardApiUrl = Effect.fn("dashboardApiUrl")(function* () {
  const configured = process.env.FLOWMARK_API_URL
  if (configured) {
    return configured
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
    return enabled
  },
)
