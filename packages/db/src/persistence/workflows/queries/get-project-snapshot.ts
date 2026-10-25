import { Effect } from "effect"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import {
  dailyVolumeSql,
  projectMetricsSql,
  recentRunsSql,
  workflowSummariesSql,
} from "../sql/run-summaries.js"
import type {
  DailyVolume,
  ProjectMetrics,
  ProjectSnapshot,
  StoredRun,
  WorkflowSummary,
} from "../types.js"

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
    db.execute<DailyVolume>(dailyVolumeSql(projectId)),
  )
  return {
    runs: Array.from(runs),
    workflows: Array.from(workflows),
    metrics,
    daily: Array.from(daily),
  } satisfies ProjectSnapshot
})
