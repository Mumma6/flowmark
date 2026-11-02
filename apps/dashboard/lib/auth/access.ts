import { Effect, Option } from "effect"
import "server-only"
import { dashboardApiUrl } from "../config/server"
import { readDashboardOnboarding, readDashboardSession } from "./session"

/** Anonymous requests never attempt onboarding. Failures remain failures. */
export const readDashboardAccess = Effect.fn("Dashboard.readAccess")(
  function* () {
    const session = yield* readDashboardSession()
    if (Option.isNone(session)) {
      return Option.none()
    }
    const onboarding = yield* readDashboardOnboarding()
    const apiOrigin = yield* dashboardApiUrl()
    return Option.some({ session: session.value, onboarding, apiOrigin })
  },
)
