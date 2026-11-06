import { sql } from "drizzle-orm"
import { Effect, Match } from "effect"
import { Database, InvalidResultQuery } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { resolveBoundedSectionLimit } from "../bounded-read-limits.js"
import {
  encodeWorkflowDiscoveryCursor,
  scopeWorkflowDiscoveryCursor,
} from "../workflow-discovery-cursor.js"
import {
  WORKFLOW_DISCOVERY_CAPABILITIES,
  type WorkflowDiscoveryPage,
  type WorkflowDiscoveryQuery,
} from "../types.js"

const workflowNamesSql = (projectId: string) => sql`
  SELECT name FROM (
    SELECT name FROM workflows WHERE project_id = ${projectId}::uuid
    UNION
    SELECT workflow AS name
    FROM workflow_result_declarations
    WHERE project_id = ${projectId}::uuid
    UNION
    SELECT workflow AS name
    FROM workflow_search_fields
    WHERE project_id = ${projectId}::uuid
  ) discovered
`

export const getWorkflowDiscoveryPage = Effect.fn("getWorkflowDiscoveryPage")(
  function* (projectId: string, query: WorkflowDiscoveryQuery) {
    const limit = resolveBoundedSectionLimit(query.limit)
    if (limit === null) {
      return yield* new InvalidResultQuery({
        message: "Invalid workflow discovery limit.",
      })
    }
    const scoped = scopeWorkflowDiscoveryCursor(query.cursor, projectId)
    const afterName = yield* Match.value(scoped).pipe(
      Match.tag("Start", () => Effect.succeed<string | null>(null)),
      Match.tag("Continue", ({ name }) => Effect.succeed<string | null>(name)),
      Match.tag("Invalid", () =>
        Effect.fail(
          new InvalidResultQuery({
            message: "Invalid workflow discovery cursor.",
          }),
        ),
      ),
      Match.exhaustive,
    )
    const db = yield* Database
    const [countRow] = yield* runQuery(
      DatabaseOperation.ReadWorkflowDiscovery,
      () =>
        db.execute<{ count: number }>(sql`
          SELECT count(*)::int AS count FROM (${workflowNamesSql(projectId)}) names
        `),
    )
    const rows = yield* runQuery(DatabaseOperation.ReadWorkflowDiscovery, () =>
      db.execute<{ name: string }>(sql`
        SELECT name
        FROM (${workflowNamesSql(projectId)}) names
        WHERE (${afterName}::text IS NULL OR name > ${afterName})
        ORDER BY name
        LIMIT ${limit + 1}
      `),
    )
    const pageRows = Array.from(rows)
    const hasMore = pageRows.length > limit
    const workflows = (hasMore ? pageRows.slice(0, limit) : pageRows).map(
      (row) => ({ name: row.name }),
    )
    const last = workflows.at(-1)
    return {
      workflows,
      nextCursor:
        hasMore && last
          ? encodeWorkflowDiscoveryCursor({ projectId, name: last.name })
          : null,
      limit,
      total: Number(countRow?.count ?? 0),
      applied: {
        projectId,
        workflow: null,
        revision: null,
        cursor: query.cursor ?? null,
        limit,
      },
      omissions: {
        continued: hasMore,
        truncatedRecords: 0,
      },
      capabilities: WORKFLOW_DISCOVERY_CAPABILITIES,
    } satisfies WorkflowDiscoveryPage
  },
)
