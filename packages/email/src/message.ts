import { Schema } from "effect"

export const Mailbox = Schema.String.check(
  Schema.isMaxLength(254),
  Schema.isPattern(
    /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/,
  ),
)

const common = {
  to: Mailbox,
  // An opaque UUID for one logical message, never a token, email or user ID.
  messageId: Schema.String.check(
    Schema.isPattern(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    ),
  ),
}
const link = {
  ...common,
  actionUrl: Schema.String.check(Schema.isMaxLength(4096)),
  expiresInMinutes: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(1),
    Schema.isLessThanOrEqualTo(1440),
  ),
}

export const EmailMessage = Schema.Union([
  Schema.Struct({
    ...common,
    kind: Schema.Literal("project-invitation"),
    actionUrl: Schema.String.check(Schema.isMaxLength(4096)),
    projectName: Schema.String.check(
      Schema.isMinLength(1),
      Schema.isMaxLength(80),
    ),
    inviterName: Schema.String.check(Schema.isMaxLength(80)),
  }),
  Schema.Struct({ ...common, kind: Schema.Literal("delivery-test") }),
  Schema.Struct({ ...link, kind: Schema.Literal("verify-email") }),
  Schema.Struct({ ...link, kind: Schema.Literal("reset-password") }),
  Schema.Struct({ ...link, kind: Schema.Literal("change-email") }),
  Schema.Struct({
    ...link,
    kind: Schema.Literal("confirm-email-change"),
    newEmail: Mailbox,
  }),
  Schema.Struct({
    ...common,
    kind: Schema.Literal("security-notice"),
    event: Schema.Literals(["password-changed", "email-changed"]),
  }),
])
export type EmailMessage = typeof EmailMessage.Type

export interface RenderedEmail {
  readonly to: string
  readonly subject: string
  readonly text: string
  readonly html: string
  readonly idempotencyKey: string
}
