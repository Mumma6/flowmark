import "server-only"
import { cookies } from "next/headers"
import { Data, Effect, Schema, Array } from "effect"
import { DashboardApi } from "../../platform/api-server-client"

export class EmailChangeResultError extends Data.TaggedError(
  "EmailChangeResultError",
)<{ readonly cause: unknown }> {}
export const ResultBody = Schema.Struct({
  result: Schema.NullOr(
    Schema.Literals([
      "check-new",
      "delivery-failed",
      "complete",
      "complete-notice-failed",
    ]),
  ),
})
export const readEmailChangeResult = Effect.fn("EmailChange.readResult")(
  function* () {
    const store = yield* Effect.tryPromise({
      try: () => cookies(),
      catch: (cause) => new EmailChangeResultError({ cause }),
    })
    if (
      !store.has("flowmark.email-change-result") &&
      !store.has("__Secure-flowmark.email-change-result")
    ) {
      return null
    }
    const api = yield* DashboardApi
    const cookie = Array.map(
      store.getAll(),
      (value) => `${value.name}=${value.value}`,
    ).join("; ")
    const response = yield* api
      .request("/api/auth/email-change/result", { headers: { cookie } }, 8000)
      .pipe(Effect.mapError((cause) => new EmailChangeResultError({ cause })))
    if (!response.ok) {
      return yield* new EmailChangeResultError({ cause: "Result unavailable" })
    }
    const json = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: (cause) => new EmailChangeResultError({ cause }),
    })
    return (yield* Schema.decodeUnknownEffect(ResultBody)(json).pipe(
      Effect.mapError((cause) => new EmailChangeResultError({ cause })),
    )).result
  },
)
