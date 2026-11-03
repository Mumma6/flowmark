import { Effect, Match, Schema } from "effect"
import { EmailError } from "./errors.js"
import { EmailMessage, type RenderedEmail } from "./message.js"
import {
  canonicalEmailOrigin,
  emailEnvironmentLabel,
  type EmailEnvironment,
} from "./config.js"
import { renderEmailLayout } from "./templates/layout.js"

export const renderEmail = Effect.fn("Email.render")(function* (
  input: unknown,
  origin: string,
  environment: EmailEnvironment = "local",
) {
  const trustedOrigin = yield* canonicalEmailOrigin(origin)
  const message = yield* Schema.decodeUnknownEffect(EmailMessage)(input).pipe(
    Effect.mapError(
      () =>
        new EmailError({ operation: "validation", reason: "invalid-message" }),
    ),
  )
  const environmentName = emailEnvironmentLabel(environment)
  const environmentNotice =
    environment === "production"
      ? undefined
      : `${environmentName} environment. Links in this message open ${trustedOrigin}.`
  const copy = Match.value(message).pipe(
    Match.when({ kind: "delivery-test" }, () => ({
      subject: "Flowmark email delivery test",
      body: `This is the Flowmark ${environmentName} email delivery test you requested. No account settings were changed.`,
      action:
        environment === "production"
          ? "Open Flowmark"
          : `Open Flowmark ${environmentName}`,
    })),
    Match.when({ kind: "verify-email" }, () => ({
      subject: "Verify your Flowmark email",
      body: "Confirm this email address to continue setting up your Flowmark account.",
      action: "Verify email",
    })),
    Match.when({ kind: "reset-password" }, () => ({
      subject: "Reset your Flowmark password",
      body: "A password reset was requested for your Flowmark account.",
      action: "Reset password",
    })),
    Match.when({ kind: "change-email" }, () => ({
      subject: "Confirm your new Flowmark email",
      body: "Confirm this address to change the email on your Flowmark account.",
      action: "Confirm email",
    })),
    Match.when({ kind: "security-notice" }, ({ event }) => ({
      subject: "Your Flowmark account was updated",
      body:
        event === "password-changed"
          ? "Your Flowmark password was changed."
          : "Your Flowmark email address was changed.",
      action: "Open account settings",
    })),
    Match.exhaustive,
  )
  const link = Match.value(message).pipe(
    Match.when({ kind: "delivery-test" }, () => "/"),
    Match.when({ kind: "security-notice" }, () => "/settings?section=account"),
    Match.orElse(({ actionUrl }) => actionUrl),
  )
  const actionUrl = yield* Effect.try({
    try: () => {
      const base = new URL(trustedOrigin)
      const url = new URL(link, base)
      if (
        url.origin !== base.origin ||
        url.username ||
        url.password ||
        /[\r\n]/.test(url.href)
      ) {
        throw new Error("Untrusted URL")
      }
      return url.href
    },
    catch: () =>
      new EmailError({ operation: "validation", reason: "untrusted-url" }),
  })
  const expiry = Match.value(message).pipe(
    Match.when(
      { kind: "delivery-test" },
      () => "No action is required. Reply to this email if you need help.",
    ),
    Match.when(
      { kind: "security-notice" },
      () =>
        "If you did not make this change, open Flowmark directly and review your account security.",
    ),
    Match.orElse(
      ({ expiresInMinutes }) =>
        `This link expires in ${expiresInMinutes} minutes. If you did not request this, you can ignore this email.`,
    ),
  )
  const subject =
    environment === "production"
      ? copy.subject
      : `[${environmentName}] ${copy.subject}`
  return {
    to: message.to,
    subject,
    text: `${subject}\n\n${environmentNotice ? `${environmentNotice}\n\n` : ""}${copy.body}\n\n${copy.action}: ${actionUrl}\n\n${expiry}\n\nFlowmark`,
    html: renderEmailLayout({
      ...copy,
      actionUrl,
      notice: expiry,
      environmentLabel:
        environment === "production" ? undefined : environmentName,
      environmentNotice,
      deliveryTest: message.kind === "delivery-test",
    }),
    idempotencyKey: `flowmark/${environment}/${message.kind}/${message.messageId}`,
  } satisfies RenderedEmail
})
