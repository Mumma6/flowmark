import { sql } from "drizzle-orm"
import { Effect } from "effect"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { projectRunSummaries } from "../../workflows/sql/run-summaries.js"
import type { StoredRun } from "../../workflows/types.js"
export const readBusinessRunSource = Effect.fn("readBusinessRunSource")(
  function* (projectId: string, runId: string) {
    const db = yield* Database
    const [row] = yield* runQuery(DatabaseOperation.BusinessEvidence, () =>
      db.execute<
        Pick<
          StoredRun,
          | "id"
          | "workflow"
          | "status"
          | "outcome"
          | "startedAt"
          | "durationMs"
          | "result"
        > & { definitionRevision: string | null; properties: unknown }
      >(
        sql`${projectRunSummaries(projectId, { runId })} SELECT s.id,s.workflow,s.status,s.outcome,s."startedAt"::text AS "startedAt",s."durationMs",s.result,s."definitionRevision",r.properties FROM runs s JOIN workflow_runs r ON r.id=s.id`,
      ),
    )
    return row ?? null
  },
)
