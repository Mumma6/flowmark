import { sql } from "drizzle-orm"
import { Effect } from "effect"
import { waitlist } from "../../../schema/waitlist.js"
import { Database, DatabaseError } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export const joinWaitlist = Effect.fn("joinWaitlist")(function* (
  email: string,
) {
  const db = yield* Database
  const rows = yield* runQuery(DatabaseOperation.JoinWaitlist, () =>
    db.execute<{
      id: string
      startedAt: number
      submittedAt: number | null
    }>(sql`
      INSERT INTO ${waitlist} (email, welcome_started_at)
      VALUES (${email}, now())
      ON CONFLICT (lower(email)) DO UPDATE
      SET welcome_started_at = coalesce(${waitlist.welcomeStartedAt}, now())
      RETURNING ${waitlist.id} AS "id", (extract(epoch FROM ${waitlist.welcomeStartedAt}) * 1000)::float8 AS "startedAt",
        (extract(epoch FROM ${waitlist.welcomeSubmittedAt}) * 1000)::float8 AS "submittedAt"
    `),
  )
  const row = rows[0]
  if (!row || !row.startedAt) {
    return yield* new DatabaseError({
      operation: DatabaseOperation.JoinWaitlist,
      cause: "Waitlist registration did not return its delivery identity.",
    })
  }
  return {
    id: row.id,
    startedAt: new Date(row.startedAt),
    submittedAt: row.submittedAt === null ? null : new Date(row.submittedAt),
  }
})
