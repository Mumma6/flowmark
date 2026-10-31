import { sql } from "drizzle-orm"
import { Effect } from "effect"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

/** One bounded page. Caller saves the returned cursor only after this transaction commits. */
export const backfillRunFacts = Effect.fn("backfillRunFacts")(function* (
  projectId: string,
  after: string | null,
  limit: number,
  apply: boolean,
) {
  const db = yield* Database
  return yield* runQuery(DatabaseOperation.BackfillRunFacts, () =>
    db.transaction((tx) =>
      Effect.runPromise(
        Effect.gen(function* () {
          yield* runQuery(DatabaseOperation.BackfillRunFacts, () =>
            tx.execute(sql`SET LOCAL lock_timeout = '5s'`),
          )
          yield* runQuery(DatabaseOperation.BackfillRunFacts, () =>
            tx.execute(sql`SET LOCAL statement_timeout = '30s'`),
          )
          const rows = yield* runQuery(DatabaseOperation.BackfillRunFacts, () =>
            tx.execute<{ id: string; projected: boolean; fresh: boolean }>(sql`
            SELECT r.id, (f.version = 1) IS TRUE AS projected, (f.version = 1 AND f.source_receipt = coalesce((
              SELECT max(e.receipt_order) FROM workflow_events e WHERE e.run_id = r.id
            ), 0) AND (SELECT count(*) FROM workflow_metric_facts m WHERE m.run_id = r.id) =
              (SELECT count(*) FROM workflow_events e WHERE e.run_id = r.id AND e.type IN ('operation_started','operation_completed','operation_failed','failed'))
            ) IS TRUE AS fresh
            FROM workflow_runs r JOIN workflows w ON w.id = r.workflow_id
            LEFT JOIN workflow_run_facts f ON f.run_id = r.id
            WHERE w.project_id = ${projectId}::uuid AND (${after}::uuid IS NULL OR r.id > ${after}::uuid)
            ORDER BY r.id LIMIT ${Math.min(Math.max(limit, 1), 100)}
            FOR UPDATE OF r
          `),
          )
          if (apply) {
            for (const row of rows) {
              yield* runQuery(DatabaseOperation.BackfillRunFacts, () =>
                tx.execute(
                  sql`SELECT flowmark_rebuild_run_facts(${row.id}::uuid)`,
                ),
              )
            }
          }
          return {
            inspected: rows.length,
            fresh: rows.filter((row) => row.fresh).length,
            needsRebuild: rows.filter((row) => !row.fresh).length,
            missing: rows.filter((row) => !row.projected).length,
            stale: rows.filter((row) => row.projected && !row.fresh).length,
            rebuilt: apply ? rows.length : 0,
            after: rows.at(-1)?.id ?? after,
          }
        }),
      ),
    ),
  )
})
