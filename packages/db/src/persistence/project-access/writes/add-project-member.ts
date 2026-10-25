import { Effect } from "effect"
import { projectMembers } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export const addProjectMember = Effect.fn("addProjectMember")(function* (
  userId: string,
  projectId: string,
) {
  const db = yield* Database
  yield* runQuery(DatabaseOperation.AddProjectMember, () =>
    db
      .insert(projectMembers)
      .values({ userId, projectId, role: "owner" })
      .onConflictDoNothing(),
  )
})
