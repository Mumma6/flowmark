import { and, eq, sql } from "drizzle-orm"
import { Effect } from "effect"
import { projectBrowserKeys } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export const consumeBrowserQuota = Effect.fn("consumeBrowserQuota")(function* (
  keyId: string,
) {
  const db = yield* Database
  const expired = sql`${projectBrowserKeys.rateWindowStartedAt} <= now() - interval '1 minute'`
  const rows = yield* runQuery(DatabaseOperation.BrowserRateLimit, () =>
    db
      .update(projectBrowserKeys)
      .set({
        rateWindowStartedAt: sql`CASE WHEN ${expired} THEN now() ELSE ${projectBrowserKeys.rateWindowStartedAt} END`,
        rateWindowCount: sql`CASE WHEN ${expired} THEN 1 ELSE ${projectBrowserKeys.rateWindowCount} + 1 END`,
      })
      .where(
        and(
          eq(projectBrowserKeys.id, keyId),
          sql`(${expired} OR ${projectBrowserKeys.rateWindowCount} < 120)`,
        ),
      )
      .returning({ id: projectBrowserKeys.id }),
  )
  return rows.length > 0
})
