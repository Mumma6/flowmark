import { desc, eq } from "drizzle-orm"
import { Effect } from "effect"
import { projectApiKeys } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import type { ApiKeySummary } from "../types.js"

export const listApiKeys = Effect.fn("listApiKeys")(function* (
  projectId: string,
) {
  const db = yield* Database
  const rows = yield* runQuery(DatabaseOperation.ListApiKeys, () =>
    db
      .select({
        id: projectApiKeys.id,
        name: projectApiKeys.name,
        prefix: projectApiKeys.keyPrefix,
        permission: projectApiKeys.permission,
        createdAt: projectApiKeys.createdAt,
      })
      .from(projectApiKeys)
      .where(eq(projectApiKeys.projectId, projectId))
      .orderBy(desc(projectApiKeys.createdAt)),
  )
  return rows.map(
    (row): ApiKeySummary => ({
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      permission: row.permission,
      createdAt: row.createdAt.toISOString(),
    }),
  )
})
