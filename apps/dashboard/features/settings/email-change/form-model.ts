import { Data, Effect, Redacted, Schema, String, pipe } from "effect"

export class EmailChangeFormError extends Data.TaggedError(
  "EmailChangeFormError",
)<{
  readonly field: "email" | "confirmation" | "password"
  readonly message: string
}> {}

const Address = Schema.String.check(
  Schema.isMaxLength(254),
  Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
)
const Password = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(1024),
)
const normalize = (value: string) =>
  pipe(value, String.trim, String.toLowerCase)

/** Form validation does not grant authority; the provider rechecks the account. */
export const prepareEmailChange = Effect.fn("EmailChange.prepareForm")(
  function* (input: {
    readonly currentEmail: string
    readonly newEmail: string
    readonly confirmation: string
    readonly password: string
  }) {
    const newEmail = yield* Schema.decodeUnknownEffect(Address)(
      normalize(input.newEmail),
    ).pipe(
      Effect.mapError(
        () =>
          new EmailChangeFormError({
            field: "email",
            message: "Enter a valid email address of at most 254 characters.",
          }),
      ),
    )
    if (newEmail === normalize(input.currentEmail)) {
      return yield* new EmailChangeFormError({
        field: "email",
        message: "Choose an address different from your current email.",
      })
    }
    if (newEmail !== normalize(input.confirmation)) {
      return yield* new EmailChangeFormError({
        field: "confirmation",
        message: "The new email addresses do not match.",
      })
    }
    const password = yield* Schema.decodeUnknownEffect(Password)(
      input.password,
    ).pipe(
      Effect.mapError(
        () =>
          new EmailChangeFormError({
            field: "password",
            message: "Enter your current password.",
          }),
      ),
      Effect.map(Redacted.make),
    )
    return { newEmail, password }
  },
)
