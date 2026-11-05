import { sql } from "drizzle-orm"
import { Effect } from "effect"
import {
  BOUNDED_SECTION_DEFAULT_LIMIT,
  BOUNDED_SECTION_MAX_LIMIT,
} from "../bounded-read-limits.js"
import { Database, InvalidResultQuery } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { allRelatedRunLinksSql } from "../sql/all-related-run-links.js"
import {
  decodeRelatedRunsPageCursor,
  encodeRelatedRunsPageCursor,
} from "../related-runs-page-cursor.js"
import type {
  RelatedRunLink,
  RelatedRunsPage,
  RelatedRunsPageQuery,
} from "../types.js"
import type { RunStatus } from "../types.js"
import { runTimelineJoins } from "./run-timeline-mapping.js"
import { workflowRuns, workflows } from "../../../schema/index.js"
import { eq } from "drizzle-orm"

const assertRunInProject = Effect.fn("assertRunInProjectForRelatedPage")(
  function* (projectId: string, runId: string) {
    const db = yield* Database
    const rows = yield* runQuery(DatabaseOperation.ReadRelatedRuns, () =>
      db
        .select({ id: workflowRuns.id })
        .from(workflowRuns)
        .innerJoin(workflows, eq(workflowRuns.workflowId, workflows.id))
        .where(runTimelineJoins(projectId, runId))
        .limit(1),
    )
    if (rows.length === 0) {
      return yield* new InvalidResultQuery({
        message: "Run not found in this project.",
      })
    }
  },
)

export const getRelatedRunsPage = Effect.fn("getRelatedRunsPage")(function* (
  projectId: string,
  query: RelatedRunsPageQuery,
) {
  yield* assertRunInProject(projectId, query.runId)
  const decoded = decodeRelatedRunsPageCursor(query.cursor)
  if (query.cursor && !decoded) {
    return yield* new InvalidResultQuery({
      message: "Invalid related runs page cursor.",
    })
  }
  const limit = Math.min(
    BOUNDED_SECTION_MAX_LIMIT,
    Math.max(1, query.limit ?? BOUNDED_SECTION_DEFAULT_LIMIT),
  )
  const db = yield* Database
  const [countRow] = yield* runQuery(DatabaseOperation.ReadRelatedRuns, () =>
    db.execute<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM (${allRelatedRunLinksSql(projectId, query.runId)}) links
    `),
  )
  const totalLinks = countRow?.count ?? 0
  const rows = yield* runQuery(DatabaseOperation.ReadRelatedRuns, () =>
    db.execute<{
      id: string
      externalId: string
      workflow: string
      startedAt: string
      status: string
      correlationId: string | null
      parentRunId: string | null
      relationship: RelatedRunLink["relationship"]
    }>(sql`
      SELECT
        links.id,
        links."externalId",
        links.workflow,
        links."startedAt",
        links.status,
        links."correlationId",
        links."parentRunId",
        links.relationship
      FROM (${allRelatedRunLinksSql(projectId, query.runId)}) links
      WHERE (
        ${decoded?.startedAt ?? null}::timestamptz IS NULL
        OR (links."startedAt", links.id) > (${decoded?.startedAt ?? null}::timestamptz, ${decoded?.id ?? null}::uuid)
      )
      ORDER BY links."startedAt", links.id, links.relationship
      LIMIT ${limit + 1}
    `),
  )
  const pageRows = Array.from(rows)
  const hasMore = pageRows.length > limit
  const items = (hasMore ? pageRows.slice(0, limit) : pageRows).map((row) => ({
    id: row.id,
    externalId: row.externalId,
    workflow: row.workflow,
    startedAt: row.startedAt,
    status: row.status as RunStatus,
    correlationId: row.correlationId,
    parentRunId: row.parentRunId,
    relationship: row.relationship,
  }))
  const last = items.at(-1)
  return {
    runId: query.runId,
    items,
    nextCursor:
      hasMore && last
        ? encodeRelatedRunsPageCursor({
            startedAt: last.startedAt,
            id: last.id,
          })
        : null,
    limit,
    totalLinks,
  } satisfies RelatedRunsPage
})
