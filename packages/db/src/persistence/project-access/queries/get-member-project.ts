import { activeProjectOwners } from "../../account-lifecycle/active-account.js"
import { sql, and, eq, isNull } from "drizzle-orm"
import { Effect } from "effect"
import { projectMembers, projects } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export const getMemberProject = Effect.fn("getMemberProject")(function* (
  userId: string,
  projectId: string,
) {
  const db = yield* Database
  const rows = yield* runQuery(DatabaseOperation.GetMemberProject, () =>
    db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .innerJoin(projects, eq(projects.id, projectMembers.projectId))
      .where(
        and(
          eq(projectMembers.userId, userId),
          isNull(projects.lifecycleOperationId),
          activeProjectOwners(sql`${projects.id}`),
          eq(projectMembers.projectId, projectId),
        ),
      )
      .limit(1),
  )
  return rows[0]?.projectId
})
