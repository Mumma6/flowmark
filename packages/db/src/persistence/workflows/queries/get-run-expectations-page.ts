import { validExpectationProjectionSql } from "../sql/expectations.js"
import { sql } from "drizzle-orm"
import { Effect } from "effect"
import {
  expectationState,
  type ExpectationEvent,
  type ExpectationRecord,
} from "@flowmarkdev/core"
import {
  BOUNDED_SECTION_DEFAULT_LIMIT,
  BOUNDED_SECTION_MAX_LIMIT,
} from "../bounded-read-limits.js"
import { boundJsonPreview } from "../bounded-record-preview.js"
import { Database, InvalidResultQuery } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { ExpectationObservationClock } from "../observation-clock.js"
import {
  decodeExpectationsPageCursor,
  encodeExpectationsPageCursor,
} from "../expectations-page-cursor.js"
import type { RunExpectationsPage, RunExpectationsPageQuery } from "../types.js"
import { eq } from "drizzle-orm"
import { workflowRuns, workflows } from "../../../schema/index.js"
import { runTimelineJoins } from "./run-timeline-mapping.js"

type Row = {
  outOfOrder: boolean | null
  workflow: string
  externalId: string
  expectationId: string
  declaredAt: string | null
  deadlineAt: string | null
  settledAt: string | null
  settlementType: string | null
  declarationId: string | null
  declaration: ExpectationEvent | null
  settlementId: string | null
  settlement: ExpectationEvent | null
}

const mapRecord = (row: Row, asOf: string): ExpectationRecord => ({
  reference: {
    version: 1,
    workflow: row.workflow,
    runId: row.externalId,
    expectationId: row.expectationId,
  },
  name:
    row.declaration?.type === "expectation_declared"
      ? row.declaration.name
      : null,
  source: row.workflow.startsWith("browser.") ? "browser" : "server",
  state: expectationState(
    row.deadlineAt,
    row.settlementType,
    row.settledAt,
    asOf,
  ),
  declaredAt:
    row.declaredAt === null ? null : new Date(row.declaredAt).toISOString(),
  deadlineAt:
    row.deadlineAt === null ? null : new Date(row.deadlineAt).toISOString(),
  settledAt:
    row.settledAt === null ? null : new Date(row.settledAt).toISOString(),
  declaration:
    row.declaration && row.declarationId
      ? {
          eventId: row.declarationId,
          event: row.declaration,
        }
      : null,
  settlement:
    row.settlement && row.settlementId
      ? {
          eventId: row.settlementId,
          event: row.settlement,
        }
      : null,
  outOfOrder: row.outOfOrder ?? false,
  cancelledAfterDeadline:
    row.settlementType === "expectation_cancelled" &&
    row.deadlineAt !== null &&
    row.settledAt !== null &&
    Date.parse(row.settledAt) > Date.parse(row.deadlineAt),
})

const withBoundedEvidence = (record: ExpectationRecord): ExpectationRecord => {
  const declarationPreview = record.declaration
    ? boundJsonPreview(record.declaration)
    : null
  const settlementPreview = record.settlement
    ? boundJsonPreview(record.settlement)
    : null
  const omissions = [
    ...(declarationPreview?.omissions ?? []),
    ...(settlementPreview?.omissions ?? []),
  ]
  if (omissions.length === 0) {
    return record
  }
  return {
    ...record,
    declaration: declarationPreview
      ? {
          eventId: record.declaration!.eventId,
          event: declarationPreview.value as ExpectationEvent,
        }
      : null,
    settlement: settlementPreview
      ? {
          eventId: record.settlement!.eventId,
          event: settlementPreview.value as ExpectationEvent,
        }
      : null,
  }
}

const assertRunInProject = Effect.fn("assertRunInProjectForExpectationsPage")(
  function* (projectId: string, runId: string) {
    const db = yield* Database
    const rows = yield* runQuery(DatabaseOperation.ReadExpectations, () =>
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

export const getRunExpectationsPage = Effect.fn("getRunExpectationsPage")(
  function* (projectId: string, query: RunExpectationsPageQuery) {
    yield* assertRunInProject(projectId, query.runId)
    const decoded = decodeExpectationsPageCursor(query.cursor)
    if (query.cursor && !decoded) {
      return yield* new InvalidResultQuery({
        message: "Invalid expectations page cursor.",
      })
    }
    const limit = Math.min(
      BOUNDED_SECTION_MAX_LIMIT,
      Math.max(1, query.limit ?? BOUNDED_SECTION_DEFAULT_LIMIT),
    )
    const db = yield* Database
    const clock = yield* ExpectationObservationClock
    return yield* runQuery(DatabaseOperation.ReadExpectations, () =>
      db.transaction(
        (tx) =>
          Effect.runPromise(
            Effect.gen(function* () {
              const asOf = (yield* clock.now(tx)).toISOString()
              const [countRow] = yield* runQuery(
                DatabaseOperation.ReadExpectations,
                () =>
                  tx.execute<{ count: number }>(sql`
      SELECT count(*)::int AS count
      FROM workflow_expectations x
      JOIN workflow_runs r ON r.id = x.run_id
      JOIN workflows w ON w.id = r.workflow_id
      WHERE w.project_id = ${projectId}
        AND r.id = ${query.runId}
        AND ${validExpectationProjectionSql}
    `),
              )
              const cursorFilter =
                decoded === null
                  ? sql`true`
                  : sql`(COALESCE(x.declared_at, 'epoch'::timestamptz), x.expectation_id) > (
                      COALESCE(${decoded.declaredAt === "" ? null : decoded.declaredAt}::timestamptz, 'epoch'::timestamptz),
                      ${decoded.expectationId}
                    )`
              const rows = yield* runQuery(
                DatabaseOperation.ReadExpectations,
                () =>
                  tx.execute<Row>(sql`
      SELECT w.name as workflow, r.external_id as "externalId", x.expectation_id as "expectationId",
        x.declared_at::text as "declaredAt", x.deadline_at::text as "deadlineAt", x.settled_at::text as "settledAt", x.settlement_type as "settlementType",
        (s.receipt_order < d.receipt_order) as "outOfOrder", d.event_id as "declarationId", d.expectation as declaration, s.event_id as "settlementId", s.expectation as settlement
      FROM workflow_expectations x JOIN workflow_runs r ON r.id = x.run_id JOIN workflows w ON w.id = r.workflow_id
      LEFT JOIN workflow_events d ON d.id = x.declaration_event_id LEFT JOIN workflow_events s ON s.id = x.settlement_event_id
      WHERE w.project_id = ${projectId} AND r.id = ${query.runId} AND ${validExpectationProjectionSql}
        AND ${cursorFilter}
      ORDER BY x.declared_at NULLS LAST, x.expectation_id
      LIMIT ${limit + 1}
    `),
              )
              const [integrity] = yield* runQuery(
                DatabaseOperation.ReadExpectations,
                () =>
                  tx.execute<{ count: number }>(sql`
      SELECT count(DISTINCT e.expectation->>'expectationId')::int as count FROM workflow_events e
      JOIN workflow_runs r ON r.id = e.run_id JOIN workflows w ON w.id = r.workflow_id
      WHERE w.project_id = ${projectId} AND r.id = ${query.runId} AND e.expectation IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM workflow_expectations x WHERE x.run_id = r.id AND x.expectation_id = e.expectation->>'expectationId' AND ${validExpectationProjectionSql})
    `),
              )
              const pageRows = Array.from(rows)
              const hasMore = pageRows.length > limit
              const slice = hasMore ? pageRows.slice(0, limit) : pageRows
              const records = slice.map((row) =>
                withBoundedEvidence(mapRecord(row, asOf)),
              )
              const expectations = records.filter(
                (r) => r.state !== "unmatched",
              )
              const unmatched = records.filter((r) => r.state === "unmatched")
              const last = slice.at(-1)
              return {
                runId: query.runId,
                asOf,
                expectations,
                unmatched,
                nextCursor:
                  hasMore && last
                    ? encodeExpectationsPageCursor({
                        declaredAt: last.declaredAt,
                        expectationId: last.expectationId,
                      })
                    : null,
                limit,
                totalRecords: countRow?.count ?? 0,
                unavailableCount: integrity?.count ?? 0,
              } satisfies RunExpectationsPage
            }),
          ),
        { isolationLevel: "repeatable read" },
      ),
    )
  },
)
