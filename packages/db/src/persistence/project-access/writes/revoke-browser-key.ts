import { and, eq } from "drizzle-orm"
import { Effect } from "effect"
import { projectBrowserKeys } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export const revokeBrowserKey = Effect.fn("revokeBrowserKey")(function* (
  projectId: string,
  keyId: string,
) {
  const db = yield* Database
  const deleted = yield* runQuery(DatabaseOperation.RevokeBrowserKey, () =>
    db
      .delete(projectBrowserKeys)
      .where(
        and(
          eq(projectBrowserKeys.id, keyId),
          eq(projectBrowserKeys.projectId, projectId),
        ),
      )
      .returning({ id: projectBrowserKeys.id }),
  )
  return deleted.length > 0
})
