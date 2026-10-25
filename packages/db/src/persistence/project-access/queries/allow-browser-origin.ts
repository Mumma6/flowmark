import { sql } from "drizzle-orm"
import { Effect } from "effect"
import { projectBrowserKeys } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export const browserOriginAllowed = Effect.fn("browserOriginAllowed")(
  function* (origin: string) {
    const db = yield* Database
    const rows = yield* runQuery(DatabaseOperation.BrowserOrigin, () =>
      db
        .select({ id: projectBrowserKeys.id })
        .from(projectBrowserKeys)
        .where(
          sql`${projectBrowserKeys.allowedOrigins} @> ${JSON.stringify([origin])}::jsonb`,
        )
        .limit(1),
    )
    return rows.length > 0
  },
)
