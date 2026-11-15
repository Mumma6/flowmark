"use client"

import type { QueryClient } from "@tanstack/react-query"
import { Effect } from "effect"
import { authClient } from "./auth-client"
import { makeSessionRecovery, SessionCheckError } from "./session-recovery"

/** Browser query/mutation-cache boundary. Never retries the failed mutation. */
export const createSessionFailureHandler = (
  client: QueryClient,
  onExpired: () => void,
) => {
  const check = Effect.runSync(
    makeSessionRecovery({
      hasSession: Effect.tryPromise({
        try: () =>
          authClient.getSession({ query: { disableCookieCache: true } }),
        catch: (cause) => new SessionCheckError({ cause }),
      }).pipe(
        Effect.flatMap((result) =>
          result.error
            ? Effect.fail(new SessionCheckError({ cause: result.error }))
            : Effect.succeed(result.data !== null),
        ),
        Effect.timeout(5000),
        Effect.mapError((cause) => new SessionCheckError({ cause })),
      ),
      expire: Effect.promise(() => client.cancelQueries()).pipe(
        Effect.andThen(
          Effect.sync(() => {
            client.clear()
            onExpired()
          }),
        ),
      ),
    }),
  )
  return (error: unknown) => {
    void Effect.runPromise(check(error))
  }
}
