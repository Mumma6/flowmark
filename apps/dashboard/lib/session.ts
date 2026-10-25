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

export const readDashboardSession = Effect.fn("readDashboardSession")(
  function* () {
    const apiUrl = yield* dashboardApiUrl()
    const cookieStore = yield* Effect.tryPromise({
      try: () => cookies(),
      catch: (cause) => new DashboardSessionError({ cause }),
    })
    const cookie = cookieStore
      .getAll()
      .map((item) => `${item.name}=${item.value}`)
      .join("; ")
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
