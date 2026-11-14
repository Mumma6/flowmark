import { eq, sql } from "drizzle-orm"
import { Effect } from "effect"
import { waitlist } from "../../../schema/waitlist.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export const submitWaitlistWelcome = Effect.fn("submitWaitlistWelcome")(
  function* (id: string) {
    const db = yield* Database
    yield* runQuery(DatabaseOperation.SubmitWaitlistWelcome, () =>
      db
        .update(waitlist)
        .set({
          welcomeSubmittedAt: sql`coalesce(${waitlist.welcomeSubmittedAt}, now())`,
        })
        .where(eq(waitlist.id, id)),
    )
  },
)
