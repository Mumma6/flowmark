import { isAPIError } from "better-auth/api"
import { Effect, Redacted } from "effect"
import {
  LifecycleReauthentication,
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
        isAPIError(cause) && [400, 401, 403].includes(cause.statusCode)
          ? new Unauthorized({ permission: "write" })
          : new PersistenceError({ operation: "lifecycle-reauth", cause }),
    })
    return {
      userId: identity.user.id,
      sessionId: identity.session.id,
      verifiedAt: Date.now(),
    }
  }),
})
