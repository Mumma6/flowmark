import { Context, Data, Effect, Schema } from "effect"

export class RecoveryError extends Data.TaggedError("RecoveryError")<{
  readonly reason:
    | "invalid-input"
    | "rate-limited"
    | "unavailable"
    | "invalid-link"
    | "uncertain"
}> {}

const EmailAddress = Schema.String.check(
  Schema.isMaxLength(254),
  Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
)
export const ResetToken = Schema.String.check(
  Schema.isPattern(/^[A-Za-z0-9_-]{16,256}$/),
)
const NewPassword = Schema.String.check(
  Schema.isMinLength(8),
  Schema.isMaxLength(128),
)

export class Recovery extends Context.Service<
  Recovery,
  {
    readonly request: (email: string) => Effect.Effect<void, RecoveryError>
    readonly reset: (input: {
      readonly token: string
      readonly newPassword: string
    }) => Effect.Effect<void, RecoveryError>
  }
>()("@flowmark/dashboard/Recovery") {}

export const requestRecovery = Effect.fn("Recovery.request")(function* (
  email: string,
) {
  const address = yield* Schema.decodeUnknownEffect(EmailAddress)(
    email.trim(),
  ).pipe(Effect.mapError(() => new RecoveryError({ reason: "invalid-input" })))
  return yield* (yield* Recovery).request(address)
})

export const completeRecovery = Effect.fn("Recovery.complete")(
  function* (input: {
    readonly token: unknown
    readonly newPassword: string
    readonly confirmation: string
  }) {
    const token = yield* Schema.decodeUnknownEffect(ResetToken)(
      input.token,
    ).pipe(Effect.mapError(() => new RecoveryError({ reason: "invalid-link" })))
    const newPassword = yield* Schema.decodeUnknownEffect(NewPassword)(
      input.newPassword,
    ).pipe(
      Effect.mapError(() => new RecoveryError({ reason: "invalid-input" })),
    )
    if (newPassword !== input.confirmation) {
      return yield* new RecoveryError({ reason: "invalid-input" })
    }
    return yield* (yield* Recovery).reset({ token, newPassword })
  },
)
