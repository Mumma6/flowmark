"use client"

import { Effect, Layer, Match, Schema } from "effect"
import { Recovery, RecoveryError } from "./recovery"

const ProviderResponse = Schema.Struct({ status: Schema.Literal(true) })
const failureStatus = (status: number, completion: boolean) =>
  new RecoveryError({
    reason: Match.value(status).pipe(
      Match.when(429, () => "rate-limited" as const),
      Match.when(
        (value) => completion && value === 400,
        () => "invalid-link" as const,
      ),
      Match.when(
        (value) => completion && value >= 500,
        () => "uncertain" as const,
      ),
      Match.orElse(() => "unavailable" as const),
    ),
  })

// Exported for contract tests; fetch and origin are captured at composition.
export const recoveryLayer = (
  origin: string,
  fetcher: typeof fetch = fetch,
) => {
  const post = Effect.fn("Recovery.http")(function* (
    path: string,
    body: unknown,
    completion: boolean,
  ) {
    const response = yield* Effect.tryPromise({
      try: (signal) =>
        fetcher(`/api/auth/${path}`, {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          redirect: "error",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
        }),
      catch: () =>
        new RecoveryError({ reason: completion ? "uncertain" : "unavailable" }),
    })
    if (!response.ok) {
      return yield* failureStatus(response.status, completion)
    }
    const json = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: () =>
        new RecoveryError({ reason: completion ? "uncertain" : "unavailable" }),
    })
    yield* Schema.decodeUnknownEffect(ProviderResponse)(json).pipe(
      Effect.mapError(
        () =>
          new RecoveryError({
            reason: completion ? "uncertain" : "unavailable",
          }),
      ),
    )
  })
  return Layer.succeed(
    Recovery,
    Recovery.of({
      request: (email) =>
        post(
          "request-password-reset",
          { email, redirectTo: new URL("/reset-password", origin).href },
          false,
        ),
      reset: (input) => post("reset-password", input, true),
    }),
  )
}

export const runRecovery = <A>(
  effect: Effect.Effect<A, RecoveryError, Recovery>,
) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(recoveryLayer(window.location.origin)),
      Effect.result,
    ),
  )
