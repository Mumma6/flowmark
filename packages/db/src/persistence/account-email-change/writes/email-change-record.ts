import { randomUUID } from "node:crypto"
import { and, eq, ne, sql } from "drizzle-orm"
import { Effect } from "effect"
import { verification } from "../../../schema/auth.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import {
  EmailChangeRejected,
  activeEmailChangeIdentifier,
  emailChangeNoticeIdentifier,
  type EmailChangeRecord,
  type EmailChangeProfile,
} from "../types.js"
import { getEmailChange } from "../queries/get-email-change.js"

export const createEmailChange = Effect.fn("createEmailChange")(function* (
  profile: EmailChangeProfile,
  toEmail: string,
) {
  const db = yield* Database
  yield* runQuery(DatabaseOperation.AccountEmailChange, () =>
    db
      .delete(verification)
      .where(
        eq(verification.identifier, activeEmailChangeIdentifier(profile.id)),
      ),
  )
  const record: EmailChangeRecord = {
    id: randomUUID(),
    expiresAt: new Date(Date.now() + 30 * 60_000),
    data: {
      version: 1,
      userId: profile.id,
      fromEmail: profile.email,
      toEmail,
      step: "confirm-old",
      oldTokenHash: null,
      newTokenHash: null,
      delivery: "pending",
    },
  }
  yield* runQuery(DatabaseOperation.AccountEmailChange, () =>
    db.insert(verification).values({
      id: record.id,
      identifier: activeEmailChangeIdentifier(profile.id),
      value: JSON.stringify(record.data),
      expiresAt: record.expiresAt,
    }),
  )
  return record
})
export const saveEmailChange = Effect.fn("saveEmailChange")(function* (
  record: EmailChangeRecord,
) {
  const db = yield* Database
  const updated = yield* runQuery(DatabaseOperation.AccountEmailChange, () =>
    db
      .update(verification)
      .set({
        identifier:
          record.data.step === "completed"
            ? emailChangeNoticeIdentifier(record.data.userId)
            : activeEmailChangeIdentifier(record.data.userId),
        value: JSON.stringify(record.data),
        expiresAt: record.expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(verification.id, record.id))
      .returning({ id: verification.id }),
  )
  if (updated.length !== 1) {
    return yield* new EmailChangeRejected({ reason: "Changed" })
  }
})
export const cancelEmailChange = Effect.fn("cancelEmailChange")(function* (
  userId: string,
  id: string,
) {
  const db = yield* Database
  const record = yield* getEmailChange(id)
  if (record.data.userId !== userId || record.data.step === "completed") {
    return yield* new EmailChangeRejected({ reason: "Changed" })
  }
  yield* runQuery(DatabaseOperation.AccountEmailChange, () =>
    db
      .delete(verification)
      .where(
        and(
          eq(verification.id, id),
          eq(verification.identifier, activeEmailChangeIdentifier(userId)),
        ),
      ),
  )
})
export const invalidateEmailRecovery = Effect.fn("invalidateEmailRecovery")(
  function* (userId: string, exceptId: string) {
    const db = yield* Database
    yield* runQuery(DatabaseOperation.AccountEmailChange, () =>
      db
        .delete(verification)
        .where(
          and(
            ne(verification.id, exceptId),
            sql`(${verification.value} = ${userId} OR (CASE WHEN pg_input_is_valid(${verification.value}, 'jsonb') THEN ${verification.value}::jsonb->>'userId' = ${userId} ELSE false END AND ${verification.identifier} <> ${emailChangeNoticeIdentifier(userId)}))`,
          ),
        ),
    )
  },
)
