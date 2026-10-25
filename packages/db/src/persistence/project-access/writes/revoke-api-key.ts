import { and, eq } from "drizzle-orm"
import { Effect } from "effect"
import { projectApiKeys } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export const revokeApiKey = Effect.fn("revokeApiKey")(function* (
  projectId: string,
  keyId: string,
) {
  const db = yield* Database
  const deleted = yield* runQuery(DatabaseOperation.RevokeApiKey, () =>
    db
      .delete(projectApiKeys)
      .where(
        and(
          eq(projectApiKeys.id, keyId),
          eq(projectApiKeys.projectId, projectId),
        ),
      )
      .returning({ id: projectApiKeys.id }),
  )
  return deleted.length > 0
})
