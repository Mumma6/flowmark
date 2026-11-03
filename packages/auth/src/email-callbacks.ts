import { randomUUID } from "node:crypto"
import type { BetterAuthOptions } from "better-auth"
import { Effect } from "effect"
import type { Email, EmailMessage } from "@flowmark/email"

// Seconds are supplied to Better Auth; the same duration is rendered in mail.
// This adapter does not enable verification requirements or automatic sending.
const tokenLifetimeSeconds = 30 * 60

type VerificationOptions = NonNullable<BetterAuthOptions["emailVerification"]>
type PasswordOptions = NonNullable<BetterAuthOptions["emailAndPassword"]>

type WithoutMessageId<T> = T extends unknown ? Omit<T, "messageId"> : never

/** Better Auth callbacks are explicit Promise boundaries for the email Effect. */
export const createAuthEmailCallbacks = (
  delivery: Email["Service"],
  schedule?: (task: Promise<unknown>) => void,
) => {
  const submit = (message: WithoutMessageId<EmailMessage>) =>
    Effect.sync(randomUUID).pipe(
      Effect.flatMap((messageId) => delivery.send({ ...message, messageId })),
      Effect.asVoid,
      Effect.runPromise,
    )

  const sendVerificationEmail: NonNullable<
    VerificationOptions["sendVerificationEmail"]
  > = ({ user, url }) =>
    submit({
      kind: "verify-email",
      to: user.email,
      actionUrl: url,
      expiresInMinutes: tokenLifetimeSeconds / 60,
    })

  const sendResetPassword: NonNullable<
    PasswordOptions["sendResetPassword"]
  > = ({ user, url }) =>
    submit({
      kind: "reset-password",
      to: user.email,
      actionUrl: url,
      expiresInMinutes: tokenLifetimeSeconds / 60,
    })

  const onPasswordReset: NonNullable<
    PasswordOptions["onPasswordReset"]
  > = async ({ user }) => {
    const task = submit({
      kind: "security-notice",
      to: user.email,
      event: "password-changed",
    })
    if (schedule) {
      schedule(task)
      return
    }
    await task
  }

  return {
    emailVerification: {
      expiresIn: tokenLifetimeSeconds,
      sendOnSignUp: false,
      sendOnSignIn: false,
      autoSignInAfterVerification: false,
      sendVerificationEmail,
    },
    emailAndPassword: {
      resetPasswordTokenExpiresIn: tokenLifetimeSeconds,
      sendResetPassword,
      onPasswordReset,
    },
  }
}
