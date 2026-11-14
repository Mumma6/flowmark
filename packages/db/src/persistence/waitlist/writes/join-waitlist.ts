import { Effect } from "effect"
import { waitlist } from "../../../schema/waitlist.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export const joinWaitlist = Effect.fn("joinWaitlist")(function* (
  email: string,
) {
  const db = yield* Database
  yield* runQuery(DatabaseOperation.JoinWaitlist, () =>
    db.insert(waitlist).values({ email }).onConflictDoNothing(),
  )
})
