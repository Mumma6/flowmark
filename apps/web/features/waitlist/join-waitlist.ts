import { Data, Effect, Schema } from "effect"

export class WaitlistError extends Data.TaggedError("WaitlistError")<{
  readonly message: string
}> {}
const Success = Schema.Struct({ ok: Schema.Literal(true) })
export const submitWaitlist = Effect.fn("Waitlist.submit")(function* (
  endpoint: string,
  email: string,
) {
  const response = yield* Effect.tryPromise({
    try: (signal) =>
      fetch(endpoint, {
        method: "POST",
        credentials: "omit",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      }),
    catch: () =>
      new WaitlistError({
        message: "Could not join the waitlist. Please try again.",
      }),
  })
  if (!response.ok) {
    return yield* new WaitlistError({
      message:
        response.status === 429
          ? "Too many requests. Please try again shortly."
          : "Could not join the waitlist. Please check your email address and try again.",
    })
  }
  const body = yield* Effect.tryPromise({
    try: () => response.json(),
    catch: () =>
      new WaitlistError({
        message: "Could not confirm your request. Please try again.",
      }),
  })
  return yield* Schema.decodeUnknownEffect(Success)(body).pipe(
    Effect.mapError(
      () =>
        new WaitlistError({
          message: "Could not confirm your request. Please try again.",
        }),
    ),
  )
})
