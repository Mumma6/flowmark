import { and, eq } from "drizzle-orm"
import { Effect } from "effect"
import { workflowSearchFields } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
export const getSearchFieldConfiguration = Effect.fn(
  "getSearchFieldConfiguration",
)(function* (projectId: string, workflow: string) {
  const db = yield* Database
  const rows = yield* runQuery(DatabaseOperation.ReadSearchFields, () =>
    db
      .select({
        fields: workflowSearchFields.fields,
        sources: workflowSearchFields.sources,
      })
      .from(workflowSearchFields)
      .where(
        and(
          eq(workflowSearchFields.projectId, projectId),
          eq(workflowSearchFields.workflow, workflow),
        ),
      )
      .limit(1),
  )
  return rows[0] ?? { fields: [], sources: {} }
})

export const getSearchFields = Effect.fn("getSearchFields")(function* (
  projectId: string,
  workflow: string,
) {
  return (yield* getSearchFieldConfiguration(projectId, workflow)).fields
})
