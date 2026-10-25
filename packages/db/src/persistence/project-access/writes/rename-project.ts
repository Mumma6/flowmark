import { eq } from "drizzle-orm"
import { Effect } from "effect"
import { projects } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export const renameProject = Effect.fn("renameProject")(function* (
  projectId: string,
  name: string,
) {
  const db = yield* Database
  yield* runQuery(DatabaseOperation.RenameProject, () =>
    db.update(projects).set({ name }).where(eq(projects.id, projectId)),
  )
})
