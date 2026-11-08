import { eq, sql } from "drizzle-orm"
import {
  Array as EffectArray,
  Effect,
  HashMap,
  Match,
  Option,
  pipe,
} from "effect"
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
          e.occurred_at AS "startedAt"
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
      ORDER BY "startedAt", "operationId"
      LIMIT ${limit + 1}
    `),
    )
    const pageStarted = EffectArray.fromIterable(startedRows)
    const hasMore = pageStarted.length > limit
    const slice = hasMore ? pageStarted.slice(0, limit) : pageStarted
    const operationIds = EffectArray.map(slice, (row) => row.operationId)
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
                EffectArray.map(operationIds, (id) => sql`${id}`),
                sql`, `,
              )})
              AND e.type IN ('operation_completed', 'operation_failed')
          `),
          )
    const terminals = HashMap.fromIterable(
      EffectArray.map(terminalRows, (row) => [row.operationId, row] as const),
    )
    const operations = pipe(
      slice,
      EffectArray.map((row) => {
        const terminal = HashMap.get(terminals, row.operationId)
        return {
          operationId: row.operationId,
          name: row.operationName ?? "Operation",
          startedAt: row.startedAt,
          durationMs: Option.match(terminal, {
            onNone: () => null,
            onSome: (item) => item.durationMs,
          }),
          status: Option.match(terminal, {
            onNone: () => "open" as const,
            onSome: (item) =>
              Match.value(item.type).pipe(
                Match.when("operation_failed", () => "failed" as const),
                Match.orElse(() => "completed" as const),
              ),
          }),
        }
      }),
    )
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
