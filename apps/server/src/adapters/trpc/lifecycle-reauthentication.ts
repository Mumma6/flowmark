import { isAPIError } from "better-auth/api"
import { Effect, Match, Redacted } from "effect"
import {
  LifecycleReauthentication,
  InvalidInput,
  PersistenceError,
  Unauthorized,
} from "@flowmark/api"
import { getAuth } from "../../auth"

export const lifecycleReauthentication = (
  request: Request,
): LifecycleReauthentication["Service"] => ({
  verify: Effect.fn("lifecycleReauthentication.verify")(function* (password) {
    const auth = yield* getAuth().pipe(
      Effect.mapError(
        (cause) =>
          new PersistenceError({ operation: "lifecycle-reauth", cause }),
      ),
    )
    const identity = yield* Effect.tryPromise({
      try: () =>
        auth.api.getSession({
          headers: request.headers,
          query: { disableCookieCache: true },
        }),
      catch: (cause) =>
        new PersistenceError({ operation: "lifecycle-reauth", cause }),
    })
    if (!identity) {
      return yield* new Unauthorized({ permission: "write" })
    }
    yield* Effect.tryPromise({
      try: () =>
        auth.api.verifyPassword({
          headers: request.headers,
          body: { password: Redacted.value(password) },
        }),
      catch: (cause) =>
        Match.value(cause).pipe(
          Match.when(
            (failure: unknown) =>
              isAPIError(failure) && failure.statusCode === 400,
            () =>
              new InvalidInput({ cause: "Current password was not accepted." }),
          ),
          Match.when(
            (failure: unknown) =>
              isAPIError(failure) && [401, 403].includes(failure.statusCode),
            () => new Unauthorized({ permission: "write" }),
          ),
          Match.orElse(
            (failure) =>
              new PersistenceError({
                operation: "lifecycle-reauth",
                cause: failure,
              }),
          ),
        ),
    })
    return {
      userId: identity.user.id,
      sessionId: identity.session.id,
      verifiedAt: Date.now(),
    }
  }),
})
