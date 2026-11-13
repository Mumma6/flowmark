import { activeProjectOwners } from "../../account-lifecycle/active-account.js"
import { sql, and, eq, isNull } from "drizzle-orm"
import { Effect } from "effect"
import { projectMembers, projects } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export const getProjectForUser = Effect.fn("getProjectForUser")(function* (
  userId: string,
  role?: "owner" | "diagnostic",
) {
  const db = yield* Database
  const rows = yield* runQuery(DatabaseOperation.GetProjectForUser, () =>
    db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .innerJoin(projects, eq(projects.id, projectMembers.projectId))
      .where(
        and(
          eq(projectMembers.userId, userId),
          role === "diagnostic"
            ? sql`${projectMembers.role} IN ('owner', 'viewer')`
            : role === undefined
              ? undefined
              : eq(projectMembers.role, role),
          sql`EXISTS (SELECT 1 FROM "user" actor WHERE actor.id = ${userId} AND actor.lifecycle_operation_id IS NULL)`,
          isNull(projects.lifecycleOperationId),
          activeProjectOwners(sql`${projects.id}`),
        ),
      )
      .limit(1),
  )
  return rows[0]?.projectId
})
