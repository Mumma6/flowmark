import { sql } from "drizzle-orm"
import { Effect } from "effect"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { metricFactsSql } from "../sql/metric-facts.js"

export const getOperationFacts = Effect.fn("getOperationFacts")(function* (
  projectId: string,
  runId: string,
) {
  const db = yield* Database
  const rows = yield* runQuery(DatabaseOperation.ReadOperationFacts, () =>
    db.execute<{
      type: string
      operationId: string | null
      operationName: string | null
      durationMs: number | null
      timestamp: string
    }>(sql`
      SELECT e.type, e.operation_id AS "operationId", e.operation_name AS "operationName",
        e.duration_ms AS "durationMs", e.occurred_at::text AS timestamp
      FROM ${metricFactsSql(projectId, runId)} e
      JOIN workflow_runs r ON r.id = e.run_id
      JOIN workflows w ON w.id = r.workflow_id
      WHERE w.project_id = ${projectId} AND r.id = ${runId}::uuid
        AND e.type IN ('operation_started', 'operation_completed', 'operation_failed')
      ORDER BY e.occurred_at, e.created_at, e.id
    `),
  )
  return Array.from(rows)
})
