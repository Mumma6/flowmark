import { Data, Effect, Ref, Schema, Result } from "effect"

export class SessionCheckError extends Data.TaggedError("SessionCheckError")<{
  readonly cause: unknown
}> {}

const AuthorizationError = Schema.Struct({
  data: Schema.Struct({ code: Schema.Literals(["UNAUTHORIZED", "FORBIDDEN"]) }),
})
const HttpAuthorizationError = Schema.Struct({
  status: Schema.Literals([401, 403]),
})
const AuthorizationFailure = Schema.Union([
  AuthorizationError,
  HttpAuthorizationError,
  Schema.Struct({ cause: HttpAuthorizationError }),
])

export const isAuthorizationFailure = (error: unknown) =>
  Schema.is(AuthorizationFailure)(error)

/** One confirmation at a time; project denial alone never means the session expired. */
export const makeSessionRecovery = Effect.fn("SessionRecovery.make")(
  function* (ports: {
    readonly hasSession: Effect.Effect<boolean, SessionCheckError>
    readonly expire: Effect.Effect<void>
  }) {
    const checking = yield* Ref.make(false)
    const expired = yield* Ref.make(false)
    return Effect.fn("SessionRecovery.check")(function* (error: unknown) {
      if (!isAuthorizationFailure(error) || (yield* Ref.get(expired))) {
        return
      }
      const busy = yield* Ref.getAndSet(checking, true)
      if (busy) {
        return
      }
      yield* ports.hasSession.pipe(
        Effect.result,
        Effect.flatMap(
          Result.match({
            // An unavailable auth endpoint cannot prove that a session is absent.
            onFailure: () => Effect.void,
            onSuccess: (active) =>
              active
                ? Effect.void
                : Ref.set(expired, true).pipe(Effect.andThen(ports.expire)),
          }),
        ),
        Effect.ensuring(Ref.set(checking, false)),
      )
    })
  },
)
