import { sql } from "drizzle-orm"
import { Effect } from "effect"
import {
  Database,
  DatabaseReadBudget,
  InvalidResultQuery,
} from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { metricFactsSql } from "../sql/metric-facts.js"

export const getOperationFacts = Effect.fn("getOperationFacts")(function* (
  projectId: string,
  runId: string,
) {
  const db = yield* Database
  const budget = yield* DatabaseReadBudget
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
      ${budget.maxOperationFacts === undefined ? sql`` : sql`LIMIT ${budget.maxOperationFacts + 1}`}
    `),
  )
  if (
    budget.maxOperationFacts !== undefined &&
    rows.length > budget.maxOperationFacts
  ) {
    return yield* new InvalidResultQuery({
      message:
        "Operation comparison exceeds its bounded evidence budget. Inspect paginated operations with get_run instead.",
    })
  }
  return Array.from(rows)
})
