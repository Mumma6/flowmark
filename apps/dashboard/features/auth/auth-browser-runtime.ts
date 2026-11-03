"use client"

import { Effect, Layer, Match, Schema } from "effect"
import { BrowserAuth, DashboardAuthError } from "./operations"
import { publicConfig } from "../platform/config-public"
import { authClient } from "./auth-client"

const RegistrationResponse = Schema.Struct({
  ok: Schema.optionalKey(Schema.Boolean),
  error: Schema.optionalKey(Schema.String),
})

const authOperation = Effect.fn("BrowserAuth.operation")(function* (
  operation: string,
  reason: string,
  request: () => Promise<{ error?: { message?: string } | null }>,
) {
  const result = yield* Effect.tryPromise({
    try: request,
    catch: (cause) => new DashboardAuthError({ operation, reason, cause }),
  })
  if (result.error) {
    return yield* new DashboardAuthError({
      operation,
      reason: result.error.message ?? reason,
    })
  }
})

const BrowserAuthLive = Layer.succeed(
  BrowserAuth,
  BrowserAuth.of({
    register: Effect.fn("BrowserAuth.register")(function* (input) {
      const failure = (cause: unknown) =>
        new DashboardAuthError({
          operation: "register",
          reason: "Could not create the account.",
          cause,
        })
      const response = yield* Effect.tryPromise({
        try: (signal) =>
          fetch(publicConfig.registerPath, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
            signal,
          }),
        catch: failure,
      })
      const json = yield* Effect.tryPromise({
        try: () => response.json(),
        catch: failure,
      })
      const body = yield* Schema.decodeUnknownEffect(RegistrationResponse)(
        json,
      ).pipe(Effect.mapError(failure))
      if (!response.ok) {
        return yield* new DashboardAuthError({
          operation: "register",
          reason: body.error ?? "Could not create the account.",
        })
      }
    }),
    signIn: (input) =>
      authOperation("signIn", "Could not sign in.", () =>
        authClient.signIn.email(input),
      ),
    updateName: (name) =>
      authOperation("updateName", "Could not update the name.", () =>
        authClient.updateUser({ name }),
      ),
    changePassword: (input) =>
      authOperation("changePassword", "Could not change the password.", () =>
        authClient.changePassword({ ...input, revokeOtherSessions: true }),
      ),
    sendVerification: Effect.fn("BrowserAuth.sendVerification")(
      function* (email) {
        const failure = (reason: string) =>
          new DashboardAuthError({ operation: "verify-email", reason })
        const result = yield* Effect.tryPromise({
          try: () =>
            authClient.sendVerificationEmail({
              email,
              callbackURL: new URL(
                "/settings?section=account&emailVerification=complete",
                window.location.origin,
              ).href,
            }),
          catch: () =>
            failure("Could not request verification. Please try again later."),
        })
        if (result.error) {
          return yield* failure(
            Match.value(result.error).pipe(
              Match.when(
                { status: 429 },
                () => "Too many requests. Please wait before trying again.",
              ),
              Match.when(
                { code: "EMAIL_ALREADY_VERIFIED" },
                () =>
                  "Your email is already verified. Refresh the status below.",
              ),
              Match.orElse(
                () => "Could not request verification. Please try again later.",
              ),
            ),
          )
        }
      },
    ),
    signOut: () =>
      authOperation("signOut", "Could not sign out.", () =>
        authClient.signOut(),
      ),
  }),
)

/** React events receive a Result, keeping typed failures out of rejected UI promises. */
export const runBrowserAuth = <A>(
  effect: Effect.Effect<A, DashboardAuthError, BrowserAuth>,
) =>
  Effect.runPromise(effect.pipe(Effect.provide(BrowserAuthLive), Effect.result))
