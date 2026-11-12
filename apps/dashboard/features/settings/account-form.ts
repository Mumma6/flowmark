import { Data, Effect, Schema } from "effect"

export class AccountFormError extends Data.TaggedError("AccountFormError")<{
  readonly form: "name" | "password"
  readonly message: string
}> {}

const DisplayName = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(128),
)

const CurrentPassword = Schema.String.check(Schema.isMinLength(1))

const NewPassword = Schema.String.check(
  Schema.isMinLength(8),
  Schema.isMaxLength(128),
)

const invalidName = () =>
  new AccountFormError({
    form: "name",
    message: "Enter a display name between 1 and 128 characters.",
  })

const invalidPassword = (message: string) =>
  new AccountFormError({ form: "password", message })

export const normalizeAccountName = Effect.fn("AccountForm.normalizeName")(
  function* (name: string) {
    return yield* Schema.decodeUnknownEffect(DisplayName)(name.trim()).pipe(
      Effect.mapError(invalidName),
    )
  },
)

export const validatePasswordChange = Effect.fn("AccountForm.validatePassword")(
  function* (input: {
    readonly currentPassword: string
    readonly newPassword: string
  }) {
    const currentPassword = yield* Schema.decodeUnknownEffect(CurrentPassword)(
      input.currentPassword,
    ).pipe(
      Effect.mapError(() => invalidPassword("Enter your current password.")),
    )
    const newPassword = yield* Schema.decodeUnknownEffect(NewPassword)(
      input.newPassword,
    ).pipe(
      Effect.mapError(() =>
        invalidPassword("Use 8–128 characters for your new password."),
      ),
    )
    if (newPassword === currentPassword) {
      return yield* invalidPassword(
        "Choose a new password that is different from your current password.",
      )
    }
    return { currentPassword, newPassword } as const
  },
)
