import { Context, Data, Effect } from "effect"

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

export const updateAccountName = Effect.fn("Dashboard.updateAccountName")(
  function* (name: string) {
    const auth = yield* BrowserAuth
    yield* auth.updateName(name)
  },
)

export const changeAccountPassword = Effect.fn(
  "Dashboard.changeAccountPassword",
)(function* (input: PasswordInput) {
  const auth = yield* BrowserAuth
  yield* auth.changePassword(input)
})

export const signOut = Effect.fn("Dashboard.signOut")(function* () {
  const auth = yield* BrowserAuth
  yield* auth.signOut()
})
