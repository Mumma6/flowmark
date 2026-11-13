import { Context, Data, Effect } from "effect"
import {
  AccountFormError,
  normalizeAccountName,
  validatePasswordChange,
} from "../settings/account-form"

export class DashboardAuthError extends Data.TaggedError("DashboardAuthError")<{
  readonly operation: string
  readonly reason: string
  readonly cause?: unknown
}> {}

export type SignInInput = { readonly email: string; readonly password: string }
export type RegistrationInput = SignInInput & { readonly name: string }
export type PasswordInput = {
  readonly currentPassword: string
  readonly newPassword: string
}

export class BrowserAuth extends Context.Service<
  BrowserAuth,
  {
    readonly register: (
      input: RegistrationInput,
    ) => Effect.Effect<void, DashboardAuthError>
    readonly signIn: (
      input: SignInInput,
    ) => Effect.Effect<void, DashboardAuthError>
    readonly updateName: (
      name: string,
    ) => Effect.Effect<void, DashboardAuthError>
    readonly changePassword: (
      input: PasswordInput,
    ) => Effect.Effect<void, DashboardAuthError>
    readonly sendVerification: (
      email: string,
      returnTo?: string,
    ) => Effect.Effect<void, DashboardAuthError>
    readonly signOut: () => Effect.Effect<void, DashboardAuthError>
  }
>()("@flowmark/dashboard/BrowserAuth") {}

export const authenticate = Effect.fn("Dashboard.authenticate")(function* (
  mode: "sign-in" | "sign-up",
  input: RegistrationInput,
) {
  const auth = yield* BrowserAuth
  if (mode === "sign-up") {
    yield* auth.register(input)
  }
  yield* auth.signIn({ email: input.email, password: input.password })
  return mode === "sign-up" ? "/settings?section=projects" : "/"
})

const formFailure = (error: AccountFormError) =>
  new DashboardAuthError({
    operation: error.form === "name" ? "updateName" : "changePassword",
    reason: error.message,
  })

export const updateAccountName = Effect.fn("Dashboard.updateAccountName")(
  function* (name: string) {
    const validName = yield* normalizeAccountName(name).pipe(
      Effect.mapError(formFailure),
    )
    const auth = yield* BrowserAuth
    yield* auth.updateName(validName)
    return validName
  },
)

export const changeAccountPassword = Effect.fn(
  "Dashboard.changeAccountPassword",
)(function* (input: PasswordInput) {
  const passwords = yield* validatePasswordChange(input).pipe(
    Effect.mapError(formFailure),
  )
  const auth = yield* BrowserAuth
  yield* auth.changePassword(passwords)
})

export const signOut = Effect.fn("Dashboard.signOut")(function* () {
  const auth = yield* BrowserAuth
  yield* auth.signOut()
})

export const requestAccountEmailVerification = Effect.fn(
  "Dashboard.requestEmailVerification",
)(function* (email: string, returnTo?: string) {
  const auth = yield* BrowserAuth
  yield* auth.sendVerification(email, returnTo)
})
