import { randomUUID } from "node:crypto"
import { eq, sql } from "drizzle-orm"
import { Effect, Schema } from "effect"
import { verification } from "../../../schema/auth.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import {
  EmailChangeReceipt,
  type EmailChangeResult,
  EmailChangeRejected,
} from "../types.js"

export const saveEmailChangeReceipt = Effect.fn("saveEmailChangeReceipt")(
  function* (hash: string, userId: string, result: EmailChangeResult) {
    const db = yield* Database
    yield* runQuery(DatabaseOperation.AccountEmailChange, () =>
      db.insert(verification).values({
        id: `email-change-result:${hash}`,
        identifier: `flowmark-email-change:result:${randomUUID()}`,
        value: JSON.stringify({ userId, result }),
        expiresAt: new Date(Date.now() + 5 * 60_000),
      }),
    )
  },
)
export const consumeEmailChangeReceipt = Effect.fn("consumeEmailChangeReceipt")(
  function* (hash: string) {
    const db = yield* Database
    const [row] = yield* runQuery(DatabaseOperation.AccountEmailChange, () =>
      db
        .delete(verification)
        .where(eq(verification.id, `email-change-result:${hash}`))
        .returning(),
    )
    if (!row || row.expiresAt.getTime() <= Date.now()) {
      return null
    }
    const receipt = yield* Schema.decodeUnknownEffect(
      Schema.fromJsonString(EmailChangeReceipt),
    )(row.value).pipe(
      Effect.mapError(() => new EmailChangeRejected({ reason: "Unavailable" })),
    )
    return receipt.result
  },
)
export const pruneEmailChangeRecords = Effect.fn("pruneEmailChangeRecords")(
  function* () {
    const db = yield* Database
    yield* runQuery(DatabaseOperation.AccountEmailChange, () =>
      db.execute(
        sql`DELETE FROM verification WHERE id IN (SELECT id FROM verification WHERE identifier LIKE 'flowmark-email-change:%' AND expires_at <= now() ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED)`,
      ),
    )
  },
)
