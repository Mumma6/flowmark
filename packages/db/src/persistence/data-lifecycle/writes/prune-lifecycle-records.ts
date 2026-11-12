import { sql } from "drizzle-orm"
import { Effect } from "effect"
import { Database } from "../../database.js"
import { lifecycleQuery } from "../access.js"

/** Traffic-driven bounded physical cleanup; an unfinished fence never expires. */
export const pruneLifecycleRecords = Effect.fn("pruneLifecycleRecords")(
  function* () {
    const db = yield* Database
    yield* lifecycleQuery(() =>
      db.execute(
        sql`DELETE FROM data_lifecycle_operations WHERE id IN (SELECT id FROM data_lifecycle_operations WHERE expires_at <= now() AND state <> 'purging' ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED)`,
      ),
    )
  },
)
