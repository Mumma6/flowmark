import { desc, eq } from "drizzle-orm"
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
        name: projects.name,
        createdAt: projects.createdAt,
      })
      .from(projectMembers)
      .innerJoin(projects, eq(projects.id, projectMembers.projectId))
      .where(eq(projectMembers.userId, userId))
      .orderBy(desc(projects.createdAt)),
  )
  return rows.map((row): ProjectSummary => ({
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  }))
})
