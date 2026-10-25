import { Effect } from "effect"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import {
  failureCodeInsightsSql,
  operationInsightsSql,
} from "../sql/insights.js"
import {
  dailyInsightsSql,
  projectMetricsSql,
  recentRunsSql,
  workflowSummariesSql,
} from "../sql/run-summaries.js"
import type {
  DailyInsight,
  FailureCodeInsight,
  OperationInsight,
  ProjectMetrics,
  ProjectSnapshot,
  StoredRun,
  WorkflowSummary,
} from "../types.js"

const emptyMetrics: ProjectMetrics = {
  totalRuns: 0,
  failedRuns: 0,
  successRate: null,
  medianDurationMs: 0,
  p95DurationMs: 0,
}

export const getProjectSnapshot = Effect.fn("getProjectSnapshot")(function* (
  projectId: string,
) {
  const db = yield* Database
  const runs = yield* runQuery(DatabaseOperation.ReadRecentRuns, () =>
    db.execute<StoredRun>(recentRunsSql(projectId)),
  )
  const workflows = yield* runQuery(
    DatabaseOperation.ReadWorkflowSummaries,
    () => db.execute<WorkflowSummary>(workflowSummariesSql(projectId)),
  )
  const [metrics] = yield* runQuery(DatabaseOperation.ReadProjectMetrics, () =>
    db.execute<ProjectMetrics>(projectMetricsSql(projectId)),
  )
  const daily = yield* runQuery(DatabaseOperation.ReadDailyVolume, () =>
    db.execute<DailyInsight>(dailyInsightsSql(projectId)),
  )
  const operations = yield* runQuery(
    DatabaseOperation.ReadOperationInsights,
    () => db.execute<OperationInsight>(operationInsightsSql(projectId)),
  )
  const failureCodes = yield* runQuery(DatabaseOperation.ReadFailureCodes, () =>
    db.execute<FailureCodeInsight>(failureCodeInsightsSql(projectId)),
  )
  return {
    runs: Array.from(runs),
    workflows: Array.from(workflows),
    metrics: metrics ?? emptyMetrics,
    daily: Array.from(daily),
    operations: Array.from(operations),
    failureCodes: Array.from(failureCodes),
  } satisfies ProjectSnapshot
})
