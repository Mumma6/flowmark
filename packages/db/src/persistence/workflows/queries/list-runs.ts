import { ExpectationObservationClock } from "../observation-clock.js"
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
    expectationState: query.expectationState,
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
  const clock = yield* ExpectationObservationClock
  const end = query.startedBefore ?? (yield* clock.now(db)).toISOString()
  const endMs = Date.parse(end)
  const start =
    query.startedAfter ??
    (query.expectationState && Number.isFinite(endMs)
      ? new Date(endMs - 30 * 86400000).toISOString()
      : undefined)
  const bounded =
    start !== undefined &&
    Number.isFinite(endMs) &&
    endMs >= Date.parse(start) &&
    endMs - Date.parse(start) <= 90 * 86400000
  if (
    query.expectationState &&
    (!bounded ||
      (query.limit !== undefined &&
        (!Number.isInteger(query.limit) ||
          query.limit < 1 ||
          query.limit > 100)))
  ) {
    return yield* new InvalidResultQuery({
      message:
        "Expectation discovery requires a valid window of at most 90 days and page size 1–100.",
    })
  }
  const { rows, countRow, asOf } = yield* runQuery(
    DatabaseOperation.ListRuns,
    () =>
      db.transaction(
        (tx) =>
          Effect.runPromise(
            Effect.gen(function* () {
              const now = yield* clock.now(tx)
              const asOf = now.toISOString()
              const scoped = {
                ...filter,
                ...(query.expectationState
                  ? { startedAfter: start, startedBefore: end }
                  : {}),
                asOf,
              }
              const rows = yield* runQuery(DatabaseOperation.ListRuns, () =>
                tx.execute<ListedRun>(listRunsSql(projectId, scoped)),
              )
              const [countRow] = yield* runQuery(
                DatabaseOperation.ListRuns,
                () =>
                  tx.execute<{
                    count: number
                    totalRuns: number
                    overdueRuns: number
                    overdueExpectations: number
                  }>(listRunsCountSql(projectId, scoped)),
              )
              return { rows, countRow, asOf, bounded }
            }),
          ),
        { isolationLevel: "repeatable read" },
      ),
  )
  const page = Array.from(rows)
  const hasMore = page.length > limit
  const runs = hasMore ? page.slice(0, limit) : page
  const last = runs[runs.length - 1]
  return {
    ...(bounded && countRow
      ? {
          attention: {
            asOf,
            totalRuns: countRow.totalRuns,
            overdueRuns: countRow.overdueRuns,
            overdueExpectations: countRow.overdueExpectations,
          },
        }
      : {}),
    runs,
    nextCursor: hasMore && last ? `${last.startedAt}|${last.id}` : null,
    total: countRow?.count ?? runs.length,
    limit,
  } satisfies ListedRunsPage
})
