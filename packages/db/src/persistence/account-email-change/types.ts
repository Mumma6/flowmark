import { Data, Schema } from "effect"
import type { FlowmarkDatabase } from "../../client.js"
import type { Effect } from "effect"
import type { DatabaseError } from "../database.js"

const Hash = Schema.NullOr(
  Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
)
export const EmailChangeData = Schema.Struct({
  version: Schema.Literal(1),
  userId: Schema.NonEmptyString,
  fromEmail: Schema.NonEmptyString,
  toEmail: Schema.NonEmptyString,
  step: Schema.Literals(["confirm-old", "verify-new", "completed"]),
  oldTokenHash: Hash,
  newTokenHash: Hash,
  delivery: Schema.Literals(["pending", "submitted", "failed"]),
})
export type EmailChangeData = typeof EmailChangeData.Type
export interface EmailChangeRecord {
  readonly id: string
  readonly data: EmailChangeData
  readonly expiresAt: Date
}
export class EmailChangeRejected extends Data.TaggedError(
  "EmailChangeRejected",
)<{
  readonly reason:
    "Unavailable" | "NeedsVerification" | "Changed" | "InvalidLink"
}> {}
export type EmailChangeProfile = {
  readonly id: string
  readonly email: string
  readonly emailVerified: boolean
}
export type EmailChangeResult =
  "check-new" | "delivery-failed" | "complete" | "complete-notice-failed"
export const EmailChangeReceipt = Schema.Struct({
  userId: Schema.NonEmptyString,
  result: Schema.Literals([
    "check-new",
    "delivery-failed",
    "complete",
    "complete-notice-failed",
  ]),
})
export interface EmailChangeTransaction {
  readonly database: FlowmarkDatabase
  readonly profile: EmailChangeProfile
  readonly checkEmail: (
    expected: string,
  ) => Effect.Effect<void, DatabaseError | EmailChangeRejected>
  readonly get: (
    id: string,
  ) => Effect.Effect<EmailChangeRecord, DatabaseError | EmailChangeRejected>
  readonly create: (
    toEmail: string,
  ) => Effect.Effect<EmailChangeRecord, DatabaseError | EmailChangeRejected>
  readonly save: (
    record: EmailChangeRecord,
  ) => Effect.Effect<void, DatabaseError | EmailChangeRejected>
  readonly cancel: (
    id: string,
  ) => Effect.Effect<void, DatabaseError | EmailChangeRejected>
  readonly invalidateRecovery: (
    exceptId: string,
  ) => Effect.Effect<void, DatabaseError>
}
export const activeEmailChangeIdentifier = (userId: string) =>
  `flowmark-email-change:active:${userId}`
export const emailChangeNoticeIdentifier = (userId: string) =>
  `flowmark-email-change:notice:${userId}`
