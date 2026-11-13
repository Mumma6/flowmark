import { activeProjectOwners } from "../../account-lifecycle/active-account.js"
import { and, desc, eq, sql } from "drizzle-orm"
import { Effect } from "effect"
import { projectMembers, projects } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import type { ProjectSummary } from "../types.js"

export const listProjectsForUser = Effect.fn("listProjectsForUser")(function* (
  userId: string,
) {
  const db = yield* Database
  const rows = yield* runQuery(DatabaseOperation.ListProjectsForUser, () =>
    db
      .select({
        id: projects.id,
        role: projectMembers.role,
        name: projects.name,
        createdAt: projects.createdAt,
      })
      .from(projectMembers)
      .innerJoin(projects, eq(projects.id, projectMembers.projectId))
      .where(
        and(
          eq(projectMembers.userId, userId),
          sql`EXISTS (SELECT 1 FROM "user" actor WHERE actor.id = ${userId} AND actor.lifecycle_operation_id IS NULL)`,
          activeProjectOwners(sql`${projects.id}`),
        ),
      )
      .orderBy(desc(projects.createdAt)),
  )
  return rows.map((row): ProjectSummary => ({
    id: row.id,
    role: row.role,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  }))
})
