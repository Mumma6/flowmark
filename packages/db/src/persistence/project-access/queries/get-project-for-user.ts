import { eq } from "drizzle-orm"
import { Effect } from "effect"
import { projectMembers } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export const getProjectForUser = Effect.fn("getProjectForUser")(function* (
  userId: string,
) {
  const db = yield* Database
  const rows = yield* runQuery(DatabaseOperation.GetProjectForUser, () =>
    db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, userId))
      .limit(1),
  )
  return rows[0]?.projectId
})
