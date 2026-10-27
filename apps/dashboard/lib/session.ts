import { cookies } from "next/headers"
import { Data, Effect, Option, Schema } from "effect"
import { dashboardApiUrl } from "./server-env"

export type DashboardSession = {
  readonly user: {
    readonly id: string
    readonly email: string
    readonly name: string
  }
}

export type DashboardOnboarding = {
  readonly step: "project" | "key" | "install" | "instrument" | "run"
  readonly completedAt: string | null
}

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
  step: Schema.Literal("project", "key", "install", "instrument", "run"),
  completedAt: Schema.NullOr(Schema.String),
})

const OnboardingData = Schema.Union(
  OnboardingState,
  Schema.Struct({ json: OnboardingState }),
)

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
    const apiUrl = yield* dashboardApiUrl()
    const cookie = yield* dashboardCookie()
    if (!cookie) {
      return Option.none<DashboardSession>()
    }
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(new URL("/api/auth/get-session", apiUrl), {
          headers: { cookie },
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        }),
      catch: (cause) => new DashboardSessionError({ cause }),
    })
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
    const session = yield* Schema.decodeUnknown(SessionBody)(json).pipe(
      Effect.mapError((cause) => new DashboardSessionError({ cause })),
    )
    return Option.some(session)
  },
)

export const readDashboardOnboarding = Effect.fn("readDashboardOnboarding")(
  function* () {
    const apiUrl = yield* dashboardApiUrl()
    const cookie = yield* dashboardCookie()
    if (!cookie) {
      return Option.none<DashboardOnboarding>()
    }
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(new URL("/api/trpc/onboarding.state", apiUrl), {
          headers: { cookie },
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        }),
      catch: (cause) => new DashboardSessionError({ cause }),
    })
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
    const onboarding = yield* Schema.decodeUnknown(OnboardingBody)(json).pipe(
      Effect.mapError((cause) => new DashboardSessionError({ cause })),
    )
    return Option.some(
      "json" in onboarding.result.data
        ? onboarding.result.data.json
        : onboarding.result.data,
    )
  },
)
