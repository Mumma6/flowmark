import { eq, and, gt, desc } from "drizzle-orm"
import { Effect, Schema, Array } from "effect"
import { verification } from "../../../schema/auth.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import {
  EmailChangeData,
  EmailChangeRejected,
  activeEmailChangeIdentifier,
  emailChangeNoticeIdentifier,
} from "../types.js"

export const decodeEmailChange = Effect.fn("decodeEmailChange")(function* (
  row: typeof verification.$inferSelect,
) {
  const data = yield* Schema.decodeUnknownEffect(
    Schema.fromJsonString(EmailChangeData),
  )(row.value).pipe(
    Effect.mapError(() => new EmailChangeRejected({ reason: "Unavailable" })),
  )
  return { id: row.id, data, expiresAt: row.expiresAt }
})
export const getEmailChange = Effect.fn("getEmailChange")(function* (
  id: string,
) {
  const db = yield* Database
  const [row] = yield* runQuery(DatabaseOperation.AccountEmailChange, () =>
    db.select().from(verification).where(eq(verification.id, id)).limit(1),
  )
  if (!row || row.expiresAt.getTime() <= Date.now()) {
    return yield* new EmailChangeRejected({ reason: "InvalidLink" })
  }
  return yield* decodeEmailChange(row)
})
export const getEmailChangeStatus = Effect.fn("getEmailChangeStatus")(
  function* (userId: string) {
    const db = yield* Database
    const rows = yield* runQuery(DatabaseOperation.AccountEmailChange, () =>
      db
        .select()
        .from(verification)
        .where(
          and(
            gt(verification.expiresAt, new Date()),
            eq(verification.identifier, activeEmailChangeIdentifier(userId)),
          ),
        )
        .orderBy(desc(verification.createdAt))
        .limit(1),
    )
    const notices = yield* runQuery(DatabaseOperation.AccountEmailChange, () =>
      db
        .select()
        .from(verification)
        .where(
          and(
            gt(verification.expiresAt, new Date()),
            eq(verification.identifier, emailChangeNoticeIdentifier(userId)),
          ),
        )
        .orderBy(desc(verification.createdAt))
        .limit(10),
    )
    const decoded = yield* Effect.forEach(
      [...rows, ...notices],
      decodeEmailChange,
    )
    if (Array.some(decoded, (row) => row.data.userId !== userId)) {
      return yield* new EmailChangeRejected({ reason: "Unavailable" })
    }
    return {
      active: Array.findFirst(decoded, (row) => row.data.step !== "completed"),
      notices: Array.filter(
        decoded,
        (row) =>
          row.data.step === "completed" && row.data.delivery !== "submitted",
      ),
    }
  },
)
