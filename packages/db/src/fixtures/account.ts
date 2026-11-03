import { and, eq } from "drizzle-orm"
import { Effect } from "effect"
import { projectMembers, projects, user } from "../schema/index.js"
import { Database } from "../persistence/database.js"
import { DatabaseOperation } from "../persistence/database-operation.js"
import { runQuery } from "../persistence/run-query.js"

export const findFixtureAccount = Effect.fn("findFixtureAccount")(function* (
  email: string,
) {
  const db = yield* Database
  const [account] = yield* runQuery(DatabaseOperation.InspectDataset, () =>
    db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(eq(user.email, email)),
  )
  return account
})
export const findFixtureProjects = Effect.fn("findFixtureProjects")(function* (
  userId: string,
  name: string,
) {
  const db = yield* Database
  return yield* runQuery(DatabaseOperation.InspectDataset, () =>
    db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
      .where(
        and(
          eq(projectMembers.userId, userId),
          eq(projectMembers.role, "owner"),
          eq(projects.name, name),
        ),
      ),
  )
})
