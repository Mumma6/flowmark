import { Effect } from "effect"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { relatedRunsSql } from "../sql/related-runs.js"
import type { RelatedRun } from "../types.js"

const toRelatedRun = (row: RelatedRun): RelatedRun => ({
  id: row.id,
  externalId: row.externalId,
  workflow: row.workflow,
  startedAt: row.startedAt,
  status: row.status,
  correlationId: row.correlationId,
  parentRunId: row.parentRunId,
})

export const getRelatedRuns = Effect.fn("getRelatedRuns")(function* (
  projectId: string,
  runId: string,
) {
  const db = yield* Database
  const rows = yield* runQuery(DatabaseOperation.ReadRelatedRuns, () =>
    db.execute<RelatedRun & { relationship: "parent" | "correlated" }>(
      relatedRunsSql(projectId, runId),
    ),
  )
  const related = Array.from(rows)
  return {
    parentMatches: related
      .filter((row) => row.relationship === "parent")
      .map(toRelatedRun),
    related: related
      .filter((row) => row.relationship === "correlated")
      .map(toRelatedRun),
  }
})
