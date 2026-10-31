import { Context, Effect } from "effect"
import { sql } from "drizzle-orm"
import type { FlowmarkDatabase } from "../../client.js"
import type { DatabaseError } from "../database.js"
import { DatabaseOperation } from "../database-operation.js"
import { runQuery } from "../run-query.js"

/** Default is the storage server clock. Tests may provide a scoped deterministic clock, never an env override. */
export const ExpectationObservationClock = Context.Reference<{
  readonly now: (
    db: Pick<FlowmarkDatabase, "execute">,
  ) => Effect.Effect<Date, DatabaseError>
}>("@flowmark/db/ExpectationObservationClock", {
  defaultValue: () => ({
    now: (db) =>
      runQuery(DatabaseOperation.ReadExpectations, () =>
        db.execute<{ now: string }>(sql`select clock_timestamp()::text as now`),
      ).pipe(Effect.map(([row]) => new Date(row!.now))),
  }),
})
