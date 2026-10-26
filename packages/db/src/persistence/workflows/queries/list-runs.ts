import { Effect } from "effect"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { listRunsCountSql, listRunsSql } from "../sql/run-summaries.js"
import type {
  ListedRun,
  ListedRunsPage,
  ListRunsQuery,
} from "../types.js"

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
  const db = yield* Database
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, query.limit ?? DEFAULT_LIMIT),
  )
  const cursor = decodeCursor(query.cursor)
  const filter = {
    workflow: query.workflow,
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
        workflow: filter.workflow,
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
    nextCursor:
      hasMore && last ? `${last.startedAt}|${last.id}` : null,
    total: countRow?.count ?? runs.length,
    limit,
  } satisfies ListedRunsPage
})
