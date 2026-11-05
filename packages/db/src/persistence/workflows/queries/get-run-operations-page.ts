import { eq, sql } from "drizzle-orm"
import { Effect } from "effect"
import {
  BOUNDED_SECTION_DEFAULT_LIMIT,
  BOUNDED_SECTION_MAX_LIMIT,
} from "../bounded-read-limits.js"
import { Database, InvalidResultQuery } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { metricFactsSql } from "../sql/metric-facts.js"
import {
  decodeOperationsPageCursor,
  encodeOperationsPageCursor,
} from "../operations-page-cursor.js"
import type { RunOperationsPage, RunOperationsPageQuery } from "../types.js"
import { workflowRuns, workflows } from "../../../schema/index.js"
import { runTimelineJoins } from "./run-timeline-mapping.js"

const assertRunInProject = Effect.fn("assertRunInProjectForOperationsPage")(
  function* (projectId: string, runId: string) {
    const db = yield* Database
    const rows = yield* runQuery(DatabaseOperation.ReadOperationFacts, () =>
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

export const getRunOperationsPage = Effect.fn("getRunOperationsPage")(
  function* (projectId: string, query: RunOperationsPageQuery) {
    yield* assertRunInProject(projectId, query.runId)
    const decoded = decodeOperationsPageCursor(query.cursor)
    if (query.cursor && !decoded) {
      return yield* new InvalidResultQuery({
        message: "Invalid operations page cursor.",
      })
    }
    const limit = Math.min(
      BOUNDED_SECTION_MAX_LIMIT,
      Math.max(1, query.limit ?? BOUNDED_SECTION_DEFAULT_LIMIT),
    )
    const db = yield* Database
    const [countRow] = yield* runQuery(
      DatabaseOperation.ReadOperationFacts,
      () =>
        db.execute<{ count: number }>(sql`
      SELECT count(*)::int AS count
      FROM (
        SELECT DISTINCT e.operation_id
        FROM ${metricFactsSql(projectId, query.runId)} e
        JOIN workflow_runs r ON r.id = e.run_id
        JOIN workflows w ON w.id = r.workflow_id
        WHERE w.project_id = ${projectId}
          AND r.id = ${query.runId}::uuid
          AND e.type = 'operation_started'
          AND e.operation_id IS NOT NULL
      ) started
    `),
    )
    const totalOperations = countRow?.count ?? 0
    const startedRows = yield* runQuery(
      DatabaseOperation.ReadOperationFacts,
      () =>
        db.execute<{
          operationId: string
          operationName: string | null
          startedAt: string
        }>(sql`
      WITH started AS (
        SELECT
          e.operation_id AS "operationId",
          e.operation_name AS "operationName",
          e.occurred_at AS "startedAt",
          e.created_at AS "receivedAt",
          e.id AS row_id
        FROM ${metricFactsSql(projectId, query.runId)} e
        JOIN workflow_runs r ON r.id = e.run_id
        JOIN workflows w ON w.id = r.workflow_id
        WHERE w.project_id = ${projectId}
          AND r.id = ${query.runId}::uuid
          AND e.type = 'operation_started'
          AND e.operation_id IS NOT NULL
      )
      SELECT "operationId", "operationName", "startedAt"::text AS "startedAt"
      FROM started
      WHERE (
        ${decoded?.startedAt ?? null}::timestamptz IS NULL
        OR ("startedAt", "operationId") > (${decoded?.startedAt ?? null}::timestamptz, ${decoded?.operationId ?? null})
      )
      ORDER BY "startedAt", "receivedAt", row_id
      LIMIT ${limit + 1}
    `),
    )
    const pageStarted = Array.from(startedRows)
    const hasMore = pageStarted.length > limit
    const slice = hasMore ? pageStarted.slice(0, limit) : pageStarted
    const operationIds = slice.map((row) => row.operationId)
    const terminalRows =
      operationIds.length === 0
        ? []
        : yield* runQuery(DatabaseOperation.ReadOperationFacts, () =>
            db.execute<{
              operationId: string
              type: string
              durationMs: number | null
            }>(sql`
            SELECT e.operation_id AS "operationId", e.type, e.duration_ms AS "durationMs"
            FROM ${metricFactsSql(projectId, query.runId)} e
            JOIN workflow_runs r ON r.id = e.run_id
            JOIN workflows w ON w.id = r.workflow_id
            WHERE w.project_id = ${projectId}
              AND r.id = ${query.runId}::uuid
              AND e.operation_id IN (${sql.join(
                operationIds.map((id) => sql`${id}`),
                sql`, `,
              )})
              AND e.type IN ('operation_completed', 'operation_failed')
          `),
          )
    const terminalById = new Map<
      string,
      { durationMs: number | null; status: "completed" | "failed" }
    >()
    for (const row of terminalRows) {
      terminalById.set(row.operationId, {
        durationMs: row.durationMs,
        status: row.type === "operation_failed" ? "failed" : "completed",
      })
    }
    const operations = slice.map((row) => {
      const terminal = terminalById.get(row.operationId)
      return {
        operationId: row.operationId,
        name: row.operationName ?? "Operation",
        startedAt: row.startedAt,
        durationMs: terminal?.durationMs ?? null,
        status: terminal?.status ?? ("open" as const),
      }
    })
    const last = slice.at(-1)
    return {
      runId: query.runId,
      operations,
      nextCursor:
        hasMore && last
          ? encodeOperationsPageCursor({
              startedAt: last.startedAt,
              operationId: last.operationId,
            })
          : null,
      limit,
      totalOperations,
    } satisfies RunOperationsPage
  },
)
