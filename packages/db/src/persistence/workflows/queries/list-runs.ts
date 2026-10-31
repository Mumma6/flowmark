import { validateResultSelection } from "./validate-result-query.js"
import { Effect } from "effect"
import { Database, InvalidResultQuery } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { listRunsCountSql, listRunsSql } from "../sql/run-summaries.js"
import type { ListedRun, ListedRunsPage, ListRunsQuery } from "../types.js"

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

function decodeCursor(
  cursor: string | undefined,
): { startedAt: string; id: string } | null {
  if (!cursor) {
    return null
  }
  const [startedAt, id] = cursor.split("|")
  if (!startedAt || !id) {
    return null
  }
  return { startedAt, id }
}

export const listRuns = Effect.fn("listRuns")(function* (
  projectId: string,
  query: ListRunsQuery,
) {
  if (query.ratioSelection) {
    for (const path of [
      query.ratioSelection.numerator,
      query.ratioSelection.denominator,
    ]) {
      const field = yield* validateResultSelection(projectId, query.workflow, {
        revision: query.ratioSelection.revision,
        path,
        operator: "gte",
        value: 0,
      })
      if (!field.aggregate || field.kind !== "count") {
        return yield* new InvalidResultQuery({
          message: "Ratio evidence requires aggregatable count fields.",
        })
      }
    }
  }
  const resultField = query.resultSelection
    ? yield* validateResultSelection(
        projectId,
        query.workflow,
        query.resultSelection,
      )
    : undefined
  const db = yield* Database
  const limit = Math.min(MAX_LIMIT, Math.max(1, query.limit ?? DEFAULT_LIMIT))
  const cursor = decodeCursor(query.cursor)
  const filter = {
    ratioSelection: query.ratioSelection,
    resultField,
    resultSelection: query.resultSelection,
    outcome: query.outcome,
    definitionRevision: query.definitionRevision,
    terminalOnly: query.terminalOnly,
    startedBeforeExclusive: query.startedBeforeExclusive,
    workflow: query.workflow,
    businessKey: query.businessKey,
    businessValue: query.businessValue,
    status: query.status,
    search: query.search,
    externalId: query.externalId,
    failCode: query.failCode,
    environment: query.environment,
    release: query.release,
    correlationId: query.correlationId,
    parentRunId: query.parentRunId,
    namespace: query.namespace,
    startedAfter: query.startedAfter,
    startedBefore: query.startedBefore,
    cursorStartedAt: cursor?.startedAt,
    cursorId: cursor?.id,
    limit,
  }
  const rows = yield* runQuery(DatabaseOperation.ListRuns, () =>
    db.execute<ListedRun>(listRunsSql(projectId, filter)),
  )
  const [countRow] = yield* runQuery(DatabaseOperation.ListRuns, () =>
    db.execute<{ count: number }>(
      listRunsCountSql(projectId, {
        ratioSelection: filter.ratioSelection,
        resultField: filter.resultField,
        resultSelection: filter.resultSelection,
        outcome: filter.outcome,
        definitionRevision: filter.definitionRevision,
        terminalOnly: filter.terminalOnly,
        startedBeforeExclusive: filter.startedBeforeExclusive,
        workflow: filter.workflow,
        businessKey: filter.businessKey,
        businessValue: filter.businessValue,
        status: filter.status,
        search: filter.search,
        externalId: filter.externalId,
        failCode: filter.failCode,
        environment: filter.environment,
        release: filter.release,
        correlationId: filter.correlationId,
        parentRunId: filter.parentRunId,
        namespace: filter.namespace,
        startedAfter: filter.startedAfter,
        startedBefore: filter.startedBefore,
      }),
    ),
  )
  const page = Array.from(rows)
  const hasMore = page.length > limit
  const runs = hasMore ? page.slice(0, limit) : page
  const last = runs[runs.length - 1]
  return {
    runs,
    nextCursor: hasMore && last ? `${last.startedAt}|${last.id}` : null,
    total: countRow?.count ?? runs.length,
    limit,
  } satisfies ListedRunsPage
})
