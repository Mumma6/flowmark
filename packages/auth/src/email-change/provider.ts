import { isAPIError } from "better-auth/api"
import { Effect, Match, Redacted } from "effect"
import { AccountEmailError, AccountEmailRuntime } from "./types.js"

export const emailProviderCall = <A>(use: () => Promise<A>) =>
  Effect.tryPromise({
    try: use,
    catch: (cause) =>
      new AccountEmailError({
        reason: Match.value(cause).pipe(
          Match.when(
            (error: unknown) =>
              isAPIError(error) && [401, 403].includes(error.statusCode),
            () => "SignInRequired" as const,
          ),
          Match.when(
            (error: unknown) => isAPIError(error) && error.statusCode === 429,
            () => "RateLimited" as const,
          ),
          Match.orElse(() => "Unavailable" as const),
        ),
        cause,
      }),
  })
export const emailActor = Effect.fn("EmailChange.actor")(function* (
  headers: Headers,
  expectedSessionId?: string,
) {
  if (
    headers.has("authorization") ||
    headers.has("x-flowmark-grant-client-id")
  ) {
    return yield* new AccountEmailError({ reason: "SignInRequired" })
  }
  const runtime = yield* AccountEmailRuntime
  const actor = yield* emailProviderCall(() =>
    runtime.auth.api.getSession({
      headers,
      query: { disableCookieCache: true, disableRefresh: true },
    }),
  )
  if (!actor) {
    return yield* new AccountEmailError({ reason: "SignInRequired" })
  }
  if (expectedSessionId && actor.session.id !== expectedSessionId) {
    return yield* new AccountEmailError({ reason: "Changed" })
  }
  return actor
})
export const emailBudget = Effect.fn("EmailChange.budget")(function* (
  key: string,
  max: number,
  window = 900,
) {
  const runtime = yield* AccountEmailRuntime
  const result = yield* Effect.tryPromise({
    try: () => runtime.consume(key, { max, window }),
    catch: (cause) => new AccountEmailError({ reason: "Unavailable", cause }),
  })
  if (!result.allowed) {
    return yield* new AccountEmailError({ reason: "RateLimited" })
  }
})
export const verifyEmailChangePassword = Effect.fn(
  "EmailChange.verifyPassword",
)(function* (
  headers: Headers,
  userId: string,
  password: Redacted.Redacted<string>,
) {
  const runtime = yield* AccountEmailRuntime
  yield* emailBudget(`email-change-password:${userId}`, 5)
  yield* emailProviderCall(() =>
    runtime.auth.api.verifyPassword({
      headers,
      body: { password: Redacted.value(password) },
    }),
  ).pipe(
    Effect.catchTag("AccountEmailError", (error) =>
      isAPIError(error.cause) && error.cause.statusCode === 400
        ? Effect.fail(new AccountEmailError({ reason: "PasswordRejected" }))
        : Effect.fail(error),
    ),
  )
})
