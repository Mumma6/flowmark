import { desc, eq } from "drizzle-orm"
import { Effect } from "effect"
import { projectBrowserKeys } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import type { BrowserKeySummary } from "../types.js"

export const listBrowserKeys = Effect.fn("listBrowserKeys")(function* (
  projectId: string,
) {
  const db = yield* Database
  const rows = yield* runQuery(DatabaseOperation.ListBrowserKeys, () =>
    db
      .select({
        id: projectBrowserKeys.id,
        name: projectBrowserKeys.name,
        prefix: projectBrowserKeys.keyPrefix,
        allowedOrigins: projectBrowserKeys.allowedOrigins,
        createdAt: projectBrowserKeys.createdAt,
      })
      .from(projectBrowserKeys)
      .where(eq(projectBrowserKeys.projectId, projectId))
      .orderBy(desc(projectBrowserKeys.createdAt)),
  )
  return rows.map(
    (row): BrowserKeySummary => ({
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      allowedOrigins: row.allowedOrigins,
      createdAt: row.createdAt.toISOString(),
    }),
  )
})
