import { sql } from "drizzle-orm"
import { Array, Effect } from "effect"
import type { BusinessWorkflowSummary } from "@flowmarkdev/core"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { projectRunSummaries } from "../../workflows/sql/run-summaries.js"
/** Missing duration observations remain null, not a fabricated zero median. */
export const readBusinessWorkflows = Effect.fn("readBusinessWorkflows")(
  function* (projectId: string, workflow?: string) {
    const db = yield* Database
    const rows = yield* runQuery(DatabaseOperation.BusinessEvidence, () =>
      db.execute<BusinessWorkflowSummary>(sql`${projectRunSummaries(projectId)}
    SELECT workflow AS name, count(*)::int AS runs,
      round(100.0 * count(*) FILTER (WHERE status='Completed') / nullif(count(*) FILTER (WHERE status<>'Running'),0),1)::float8 AS "completedPercent",
      percentile_cont(0.5) WITHIN GROUP (ORDER BY "durationMs")::float8 AS "medianDurationMs",
      percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs")::float8 AS "p95DurationMs"
    FROM runs ${workflow === undefined ? sql`` : sql`WHERE workflow=${workflow}`} GROUP BY workflow ORDER BY workflow LIMIT 101`),
    )
    return Array.fromIterable(rows)
  },
)
