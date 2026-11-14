import { sql } from "drizzle-orm"
import { Match } from "effect"
import type { ErasureScope } from "../types.js"

/** Aliases r/w are fixed at the owning query; all values remain bound parameters. */
export const selectedRuns = (
  projectId: string,
  scope: ErasureScope,
  cutoff: Date,
) =>
  Match.value(scope).pipe(
    Match.when(
      { kind: "project" },
      () => sql`w.project_id = ${projectId}::uuid`,
    ),
    Match.when(
      { kind: "runs" },
      ({ runIds }) =>
        sql`w.project_id = ${projectId}::uuid AND r.created_at <= ${cutoff.toISOString()}::timestamptz AND r.id IN (SELECT jsonb_array_elements_text(${JSON.stringify(runIds)}::jsonb)::uuid)`,
    ),
    Match.when(
      { kind: "workflow" },
      ({ workflow, after, before }) =>
        sql`w.project_id = ${projectId}::uuid AND r.created_at <= ${cutoff.toISOString()}::timestamptz AND w.name = ${workflow} AND r.started_at >= ${after}::timestamptz AND r.started_at < ${before}::timestamptz`,
    ),
    Match.exhaustive,
  )
