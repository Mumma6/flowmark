import { eq } from "drizzle-orm"
import { Effect } from "effect"
import { projectMembers, projects } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export const getWorkspaceForUser = Effect.fn("getWorkspaceForUser")(function* (
  userId: string,
) {
  const db = yield* Database
  const rows = yield* runQuery(DatabaseOperation.GetWorkspaceForUser, () =>
    db
      .select({ workspaceId: projects.workspaceId })
      .from(projectMembers)
      .innerJoin(projects, eq(projects.id, projectMembers.projectId))
      .where(eq(projectMembers.userId, userId))
      .limit(1),
  )
  return rows[0]?.workspaceId
})
