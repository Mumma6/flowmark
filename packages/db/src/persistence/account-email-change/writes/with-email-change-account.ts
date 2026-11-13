import { eq, sql } from "drizzle-orm"
import { Effect } from "effect"
import type { FlowmarkDatabase } from "../../../client.js"
import { user } from "../../../schema/auth.js"
import { Database, provideDatabase } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runTransaction } from "../../run-transaction.js"
import { runQuery } from "../../run-query.js"
import { EmailChangeRejected, type EmailChangeTransaction } from "../types.js"
import { getEmailChange } from "../queries/get-email-change.js"
import {
  createEmailChange,
  saveEmailChange,
  cancelEmailChange,
  invalidateEmailRecovery,
} from "./email-change-record.js"

export const withEmailChangeAccount = Effect.fn("withEmailChangeAccount")(
  function* <A, E>(
    userId: string,
    use: (tx: EmailChangeTransaction) => Effect.Effect<A, E>,
  ) {
    const db = yield* Database
    return yield* runTransaction(
      DatabaseOperation.AccountEmailChange,
      (use) => db.transaction(use),
      (tx) =>
        Effect.gen(function* () {
          yield* runQuery(DatabaseOperation.AccountEmailChange, () =>
            tx.execute(sql`SET LOCAL statement_timeout = '5s'`),
          )
          yield* runQuery(DatabaseOperation.AccountEmailChange, () =>
            tx.execute(sql`SET LOCAL lock_timeout = '3s'`),
          )
          const [profile] = yield* runQuery(
            DatabaseOperation.AccountEmailChange,
            () =>
              tx.select().from(user).where(eq(user.id, userId)).for("update"),
          )
          if (!profile || profile.lifecycleOperationId !== null) {
            return yield* new EmailChangeRejected({ reason: "Unavailable" })
          }
          // Native Drizzle provider consumes only this transaction's query/transaction surface.
          const database = tx as unknown as FlowmarkDatabase
          const provide = provideDatabase(database)
          return yield* use({
            database,
            profile,
            checkEmail: (expected) =>
              runQuery(DatabaseOperation.AccountEmailChange, () =>
                tx.select().from(user).where(eq(user.id, userId)),
              ).pipe(
                Effect.flatMap(([current]) =>
                  current?.email === expected && current.emailVerified
                    ? Effect.void
                    : Effect.fail(
                        new EmailChangeRejected({ reason: "Changed" }),
                      ),
                ),
              ),
            get: (id) =>
              provide(getEmailChange(id)).pipe(
                Effect.flatMap((record) =>
                  record.data.userId === profile.id
                    ? Effect.succeed(record)
                    : Effect.fail(
                        new EmailChangeRejected({ reason: "InvalidLink" }),
                      ),
                ),
              ),
            create: (toEmail) => provide(createEmailChange(profile, toEmail)),
            save: (record) =>
              record.data.userId === profile.id
                ? provide(saveEmailChange(record))
                : Effect.fail(
                    new EmailChangeRejected({ reason: "InvalidLink" }),
                  ),
            cancel: (id) => provide(cancelEmailChange(profile.id, id)),
            invalidateRecovery: (exceptId) =>
              Effect.gen(function* () {
                yield* runQuery(DatabaseOperation.AccountEmailChange, () =>
                  tx.execute(
                    sql`SELECT id FROM projects WHERE id IN (SELECT project_id FROM project_invitations WHERE state = 'pending' AND (recipient_user_id = ${profile.id} OR email = ${profile.email})) ORDER BY id FOR UPDATE`,
                  ),
                )
                yield* runQuery(DatabaseOperation.AccountEmailChange, () =>
                  tx.execute(
                    sql`UPDATE project_invitations SET state = 'revoked', token_hash = NULL, updated_at = clock_timestamp() WHERE state = 'pending' AND (recipient_user_id = ${profile.id} OR email = ${profile.email})`,
                  ),
                )
                yield* provide(invalidateEmailRecovery(profile.id, exceptId))
              }),
          }).pipe(
            // Await provider promises before releasing their transaction, including on interruption.
            Effect.uninterruptible,
          )
        }),
    )
  },
)
