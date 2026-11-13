import { Data, Effect, Option, Schema } from "effect"
import { cookies } from "next/headers"
import "server-only"
import { DashboardApi } from "../platform/api-server-client"

export type DashboardSession = typeof SessionBody.Type
export type DashboardOnboarding = typeof OnboardingState.Type

export class DashboardSessionError extends Data.TaggedError(
  "DashboardSessionError",
)<{
  readonly cause: unknown
}> {}

const SessionBody = Schema.Struct({
  user: Schema.Struct({
    id: Schema.NonEmptyString,
    email: Schema.String,
    name: Schema.String,
  }),
})

const OnboardingState = Schema.Struct({
  sharedAccess: Schema.optionalKey(Schema.Boolean),
  step: Schema.Literals(["project", "key", "install", "instrument", "run"]),
  completedAt: Schema.NullOr(Schema.String),
})
const OnboardingData = Schema.Union([
  OnboardingState,
  Schema.Struct({ json: OnboardingState }),
])

const OnboardingBody = Schema.Struct({
  result: Schema.Struct({
    data: OnboardingData,
  }),
})

const dashboardCookie = Effect.fn("dashboardCookie")(function* () {
  const cookieStore = yield* Effect.tryPromise({
    try: () => cookies(),
    catch: (cause) => new DashboardSessionError({ cause }),
  })
  return cookieStore
    .getAll()
    .map((item) => `${item.name}=${item.value}`)
    .join("; ")
})

export const readDashboardSession = Effect.fn("readDashboardSession")(
  function* () {
    const api = yield* DashboardApi
    const cookie = yield* dashboardCookie()
    if (!cookie) {
      return Option.none<DashboardSession>()
    }
    const response = yield* api
      .request("/api/auth/get-session", { headers: { cookie } }, 8000)
      .pipe(Effect.mapError((cause) => new DashboardSessionError({ cause })))
    if (response.status === 401 || response.status === 403) {
      return Option.none<DashboardSession>()
    }
    if (!response.ok) {
      return yield* new DashboardSessionError({
        cause: new Error(`Session lookup failed (${response.status}).`),
      })
    }
    const json = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: (cause) => new DashboardSessionError({ cause }),
    })
    if (json == null) {
      return Option.none<DashboardSession>()
    }
    const session = yield* Schema.decodeUnknownEffect(SessionBody)(json).pipe(
      Effect.mapError((cause) => new DashboardSessionError({ cause })),
    )
    return Option.some(session)
  },
)

export const readDashboardOnboarding = Effect.fn("readDashboardOnboarding")(
  function* () {
    const api = yield* DashboardApi
    const cookie = yield* dashboardCookie()
    if (!cookie) {
      return Option.none<DashboardOnboarding>()
    }
    const response = yield* api
      .request("/api/trpc/onboarding.state", { headers: { cookie } }, 8000)
      .pipe(Effect.mapError((cause) => new DashboardSessionError({ cause })))
    if (response.status === 401 || response.status === 403) {
      return Option.none<DashboardOnboarding>()
    }
    if (!response.ok) {
      return yield* new DashboardSessionError({
        cause: new Error(`Onboarding lookup failed (${response.status}).`),
      })
    }
    const json = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: (cause) => new DashboardSessionError({ cause }),
    })
    const onboarding = yield* Schema.decodeUnknownEffect(OnboardingBody)(
      json,
    ).pipe(Effect.mapError((cause) => new DashboardSessionError({ cause })))
    return Option.some(
      "json" in onboarding.result.data
        ? onboarding.result.data.json
        : onboarding.result.data,
    )
  },
)
