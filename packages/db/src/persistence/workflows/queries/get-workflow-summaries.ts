import { Effect } from "effect"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { workflowSummariesSql } from "../sql/run-summaries.js"
import type { WorkflowSummary } from "../types.js"

export const getWorkflowSummaries = Effect.fn("getWorkflowSummaries")(
  function* (projectId: string) {
    const db = yield* Database
    const workflows = yield* runQuery(
      DatabaseOperation.ReadWorkflowSummaries,
      () => db.execute<WorkflowSummary>(workflowSummariesSql(projectId)),
    )
    return Array.from(workflows)
  },
)
