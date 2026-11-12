import { and, eq, isNull } from "drizzle-orm"
import { Effect } from "effect"
import { projectApiKeys, projects } from "../../../schema/index.js"
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
      .innerJoin(projects, eq(projects.id, projectApiKeys.projectId))
      .where(
        and(
          eq(projectApiKeys.keyHash, hashApiKey(key)),
          eq(projectApiKeys.permission, permission),
          eq(projectApiKeys.credentialEpoch, projects.credentialEpoch),
          isNull(projects.lifecycleOperationId),
        ),
      )
      .limit(1),
  )
  return rows[0]?.projectId
})
