import { and, eq, gt, sql } from "drizzle-orm"
import { Effect, Option } from "effect"
import { registrationInvitations } from "../../../schema/registration-invitations.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export const getRegistrationInvitation = Effect.fn("getRegistrationInvitation")(
  function* (email: string, tokenHash: string) {
    const db = yield* Database
    const rows = yield* runQuery(
      DatabaseOperation.ReadRegistrationInvitation,
      () =>
        db
          .select({ id: registrationInvitations.id })
          .from(registrationInvitations)
          .where(
            and(
              eq(registrationInvitations.email, email.trim().toLowerCase()),
              eq(registrationInvitations.tokenHash, tokenHash),
              gt(registrationInvitations.expiresAt, sql`now()`),
            ),
          )
          .limit(1),
    )
    return Option.fromNullishOr(rows[0])
  },
)
