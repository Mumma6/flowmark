import { isAPIError } from "better-auth/api"
import type { betterAuth } from "better-auth"
import { Array, Data, Effect, Match, Option, Redacted } from "effect"
import type { createAuthRateLimitStorage } from "../rate-limit-storage.js"
import { sessionDeviceLabel } from "./session-summary.js"

export class AccountSessionError extends Data.TaggedError(
  "AccountSessionError",
)<{
  readonly reason:
    | "SignInRequired"
    | "PasswordRejected"
    | "RateLimited"
    | "SessionUnavailable"
    | "SessionChanged"
    | "CurrentSession"
    | "Unavailable"
  readonly cause?: unknown
}> {}

export type SessionRevocation =
  | { readonly kind: "single"; readonly sessionId: string }
  | { readonly kind: "others" }

type Provider = ReturnType<typeof betterAuth>
type ConsumeBudget = ReturnType<typeof createAuthRateLimitStorage>["consume"]

/** Session ownership and revocation remain provider-owned; tokens never leave this service. */
export const createAccountSessions = (
  auth: Provider,
  consume: ConsumeBudget,
) => {
  const provider = <A>(request: () => Promise<A>) =>
    Effect.tryPromise({
      try: request,
      catch: (cause) =>
        new AccountSessionError({
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
  const identity = Effect.fn("AccountSessions.identity")(function* (
    headers: Headers,
  ) {
    const current = yield* provider(() =>
      auth.api.getSession({
        headers,
        query: { disableCookieCache: true, disableRefresh: true },
      }),
    )
    if (!current) {
      return yield* new AccountSessionError({ reason: "SignInRequired" })
    }
    return current
  })
  return {
    list: Effect.fn("AccountSessions.list")(function* (headers: Headers) {
      const current = yield* identity(headers)
      const sessions = yield* provider(() => auth.api.listSessions({ headers }))
      return {
        userId: current.user.id,
        sessions: Array.map(sessions, (session) => ({
          id: session.id,
          current: session.id === current.session.id,
          device: sessionDeviceLabel(session.userAgent),
          createdAt: session.createdAt.toISOString(),
          updatedAt: session.updatedAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
        })),
      }
    }),
    revoke: Effect.fn("AccountSessions.revoke")(function* (
      headers: Headers,
      expectedSessionId: string,
      target: SessionRevocation,
      password: Redacted.Redacted<string>,
    ) {
      const current = yield* identity(headers)
      if (current.session.id !== expectedSessionId) {
        return yield* new AccountSessionError({ reason: "SessionChanged" })
      }
      const budget = yield* Effect.tryPromise({
        try: () =>
          consume(`account-session-reauth:${current.user.id}`, {
            window: 900,
            max: 5,
          }),
        catch: (cause) =>
          new AccountSessionError({ reason: "Unavailable", cause }),
      })
      if (!budget.allowed) {
        return yield* new AccountSessionError({ reason: "RateLimited" })
      }
      yield* provider(() =>
        auth.api.verifyPassword({
          headers,
          body: { password: Redacted.value(password) },
        }),
      ).pipe(
        Effect.catchTag("AccountSessionError", (error) =>
          isAPIError(error.cause) && error.cause.statusCode === 400
            ? Effect.fail(
                new AccountSessionError({ reason: "PasswordRejected" }),
              )
            : Effect.fail(error),
        ),
      )
      if (target.kind === "others") {
        yield* provider(() => auth.api.revokeOtherSessions({ headers }))
        return { revoked: true as const }
      }
      const sessions = yield* provider(() => auth.api.listSessions({ headers }))
      const selected = Array.findFirst(
        sessions,
        (session) => session.id === target.sessionId,
      )
      const session = yield* Option.match(selected, {
        onNone: () =>
          Effect.fail(
            new AccountSessionError({ reason: "SessionUnavailable" }),
          ),
        onSome: Effect.succeed,
      })
      if (session.id === current.session.id) {
        return yield* new AccountSessionError({ reason: "CurrentSession" })
      }
      yield* provider(() =>
        auth.api.revokeSession({ headers, body: { token: session.token } }),
      )
      return { revoked: true as const }
    }),
  }
}
