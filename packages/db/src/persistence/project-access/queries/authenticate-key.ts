import { and, eq } from "drizzle-orm"
import { Effect } from "effect"
import { projectApiKeys } from "../../../schema/index.js"
import { Database, hashApiKey } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export const authenticateKey = Effect.fn("authenticateKey")(function* (
  key: string,
  permission: "read" | "write",
) {
  const db = yield* Database
  const rows = yield* runQuery(DatabaseOperation.Authenticate, () =>
    db
      .select({ projectId: projectApiKeys.projectId })
      .from(projectApiKeys)
      .where(
        and(
          eq(projectApiKeys.keyHash, hashApiKey(key)),
          eq(projectApiKeys.permission, permission),
        ),
      )
      .limit(1),
  )
  return rows[0]?.projectId
})
