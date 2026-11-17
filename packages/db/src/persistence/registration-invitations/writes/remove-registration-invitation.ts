import { and, eq } from "drizzle-orm"
import { Effect } from "effect"
import { registrationInvitations } from "../../../schema/registration-invitations.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export const removeRegistrationInvitation = Effect.fn(
  "removeRegistrationInvitation",
)(function* (email: string, tokenHash: string) {
  const db = yield* Database
  yield* runQuery(DatabaseOperation.RemoveRegistrationInvitation, () =>
    db
      .delete(registrationInvitations)
      .where(
        and(
          eq(registrationInvitations.email, email.trim().toLowerCase()),
          eq(registrationInvitations.tokenHash, tokenHash),
        ),
      ),
  )
})
