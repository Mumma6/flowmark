import { eq, sql } from "drizzle-orm"
import { Effect } from "effect"
import { workflowEvents } from "../../../schema/index.js"
import { Database, InvalidResultQuery } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { currentRunSql } from "../sql/run-summaries.js"
import type { RunInvestigationSummary, StoredRun } from "../types.js"

export const getRunInvestigationSummary = Effect.fn(
  "getRunInvestigationSummary",
)(function* (projectId: string, runId: string) {
  const db = yield* Database
  const [run] = yield* runQuery(DatabaseOperation.ReadRun, () =>
    db.execute<StoredRun>(currentRunSql(projectId, runId)),
  )
  if (!run) {
    return yield* new InvalidResultQuery({
      message: "Run not found in this project.",
    })
  }
  const [metadata] = yield* runQuery(DatabaseOperation.ReadRun, () =>
    db.execute<{ environment: string | null; release: string | null }>(sql`
      SELECT r.environment, r.release
      FROM workflow_runs r
      JOIN workflows w ON w.id = r.workflow_id
      WHERE r.id = ${runId}::uuid AND w.project_id = ${projectId}
    `),
  )
  const [counts] = yield* runQuery(DatabaseOperation.ReadRun, () =>
    db
      .select({
        eventCount: sql<number>`count(*)::int`,
        operationCount: sql<number>`count(*) filter (where ${workflowEvents.type} = 'operation_started')::int`,
        errorCount: sql<number>`count(*) filter (where ${workflowEvents.type} = 'error')::int`,
        reportCount: sql<number>`count(*) filter (where ${workflowEvents.type} = 'report')::int`,
      })
      .from(workflowEvents)
      .where(eq(workflowEvents.runId, runId)),
  )
  return {
    id: run.id,
    externalId: run.externalId,
    workflow: run.workflow,
    status: run.status,
    startedAt: run.startedAt,
    durationMs: run.durationMs,
    step: run.step,
    outcome: run.outcome ?? null,
    environment: metadata?.environment ?? null,
    release: metadata?.release ?? null,
    correlationId: run.correlationId ?? null,
    parentRunId: run.parentRunId ?? null,
    eventCount: counts?.eventCount ?? 0,
    operationCount: counts?.operationCount ?? 0,
    errorCount: counts?.errorCount ?? 0,
    reportCount: counts?.reportCount ?? 0,
  } satisfies RunInvestigationSummary
})
