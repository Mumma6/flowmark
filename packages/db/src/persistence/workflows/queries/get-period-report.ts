import { Effect } from "effect"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import {
  failureGroupsSql,
  periodDailySql,
  periodWorkflowNamesSql,
  workflowPeriodSql,
} from "../sql/period-report.js"
import type { DailyInsight, IntelligenceQuery, PeriodReport } from "../types.js"
import {
  assembleFailureGroups,
  assembleWorkflowPeriods,
  type FailureGroupRow,
  type WorkflowPeriodRow,
} from "./assemble-period-report.js"
import { getWorkflowIntelligence } from "./get-workflow-intelligence.js"

export const getPeriodReport = Effect.fn("getPeriodReport")(function* (
  projectId: string,
  query: IntelligenceQuery,
) {
  const db = yield* Database
  const current = {
    startedAfter: query.currentStartedAfter,
    startedBefore: query.currentStartedBefore,
  }
  const previous = {
    startedAfter: query.previousStartedAfter,
    startedBefore: query.previousStartedBefore,
  }
  const intelligence = yield* getWorkflowIntelligence(projectId, query)
  const workflowRows = yield* runQuery(
    DatabaseOperation.ReadPeriodWorkflows,
    () =>
      db.execute<WorkflowPeriodRow>(
        workflowPeriodSql(projectId, query.workflow, current, previous),
      ),
  )
  const nameRows = yield* runQuery(
    DatabaseOperation.ReadPeriodWorkflowNames,
    () =>
      db.execute<{ name: string }>(
        periodWorkflowNamesSql(projectId, current, previous),
      ),
  )
  const dailyRows = yield* runQuery(DatabaseOperation.ReadPeriodDaily, () =>
    db.execute<DailyInsight>(
      periodDailySql(projectId, query.workflow, current),
    ),
  )
  const failureRows = yield* runQuery(DatabaseOperation.ReadFailureGroups, () =>
    db.execute<FailureGroupRow>(
      failureGroupsSql(projectId, query.workflow, current, previous),
    ),
  )
  const failures = assembleFailureGroups(Array.from(failureRows))
  return {
    workflow: intelligence.workflow,
    current: intelligence.current,
    previous: intelligence.previous,
    daily: Array.from(dailyRows),
    workflowNames: Array.from(nameRows).map((row) => row.name),
    workflows: assembleWorkflowPeriods(Array.from(workflowRows)),
    failureGroups: failures.groups,
    failureGroupsTruncated: failures.truncated,
    operations: intelligence.operations,
  } satisfies PeriodReport
})
