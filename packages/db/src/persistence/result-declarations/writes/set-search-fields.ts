import { Effect } from "effect"
import type { SearchFields } from "@flowmarkdev/core"
import { workflowSearchFields } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
export const setSearchFields = Effect.fn("setSearchFields")(function* (
  projectId: string,
  workflow: string,
  fields: SearchFields,
) {
  const db = yield* Database
  yield* runQuery(DatabaseOperation.SetSearchFields, () =>
    db
      .insert(workflowSearchFields)
      .values({ projectId, workflow, fields })
      .onConflictDoUpdate({
        target: [workflowSearchFields.projectId, workflowSearchFields.workflow],
        set: { fields },
      }),
  )
  return fields
})
