import type { FlowmarkDatabase } from "../../../client.js"
import { and, eq, sql } from "drizzle-orm"
import { Effect } from "effect"
import {
  workflowEvents,
  workflowRuns,
  workflows,
} from "../../../schema/index.js"
import { Database, InvalidResultQuery } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import {
  decodeRunEventPageCursor,
  encodeRunEventPageCursor,
} from "../run-event-page-cursor.js"
import { boundJsonPreview } from "../bounded-record-preview.js"
import type { RunEventPage, RunEventPageQuery } from "../types.js"
import {
  mapRunTimelineRows,
  runTimelineJoins,
  runTimelineSelection,
  type RunTimelineRow,
} from "./run-timeline-mapping.js"

/** Matches Agent ADR 0008 event page defaults (see @flowmark/auth agent-access). */
export const RUN_EVENT_PAGE_DEFAULT_LIMIT = 50
export const RUN_EVENT_PAGE_MAX_LIMIT = 100

/** Metadata-only ownership/cursor guard, also inspectable with EXPLAIN. */
export const runEventPageGuardQuery = (
  db: FlowmarkDatabase,
  projectId: string,
  runId: string,
  cursor: ReturnType<typeof decodeRunEventPageCursor>,
) =>
  db
    .select({ id: workflowRuns.id })
    .from(workflowRuns)
    .innerJoin(workflows, eq(workflowRuns.workflowId, workflows.id))
    .where(
      and(
        runTimelineJoins(projectId, runId),
        cursor
          ? sql`EXISTS (
          SELECT 1 FROM ${workflowEvents} cursor_event
          WHERE cursor_event.run_id = ${workflowRuns.id}
            AND cursor_event.event_id = ${cursor.eventId}::uuid
            AND cursor_event.occurred_at = ${cursor.occurredAt}::timestamptz
            AND cursor_event.created_at = ${cursor.receivedAt}::timestamptz
        )`
          : undefined,
      ),
    )
    .limit(1)

const assertRunInProject = Effect.fn("assertRunInProject")(function* (
  projectId: string,
  runId: string,
  cursor: ReturnType<typeof decodeRunEventPageCursor>,
) {
  const db = yield* Database
  const rows = yield* runQuery(DatabaseOperation.ReadRun, () =>
    runEventPageGuardQuery(db, projectId, runId, cursor),
  )
  if (rows.length === 0) {
    return yield* new InvalidResultQuery({
      message: cursor
        ? "Invalid run event page cursor for this run."
        : "Run not found in this project.",
    })
  }
})

const cursorPredicate = (
  cursor: NonNullable<ReturnType<typeof decodeRunEventPageCursor>>,
) =>
  sql`(${workflowEvents.occurredAt}, ${workflowEvents.createdAt}, ${workflowEvents.eventId}) > (${cursor.occurredAt}::timestamptz, ${cursor.receivedAt}::timestamptz, ${cursor.eventId}::uuid)`

export const getRunEventPage = Effect.fn("getRunEventPage")(function* (
  projectId: string,
  query: RunEventPageQuery,
) {
  const decoded = decodeRunEventPageCursor(query.cursor)
  if (query.cursor && !decoded) {
    return yield* new InvalidResultQuery({
      message: "Invalid run event page cursor.",
    })
  }
  yield* assertRunInProject(projectId, query.runId, decoded)
  const limit = Math.min(
    RUN_EVENT_PAGE_MAX_LIMIT,
    Math.max(1, query.limit ?? RUN_EVENT_PAGE_DEFAULT_LIMIT),
  )
  const db = yield* Database
  const baseWhere = and(
    runTimelineJoins(projectId, query.runId),
    decoded ? cursorPredicate(decoded) : undefined,
  )
  const [countRow] = yield* runQuery(DatabaseOperation.ReadRun, () =>
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(workflowEvents)
      .innerJoin(workflowRuns, eq(workflowEvents.runId, workflowRuns.id))
      .innerJoin(workflows, eq(workflowRuns.workflowId, workflows.id))
      .where(runTimelineJoins(projectId, query.runId)),
  )
  const rows = yield* runQuery(DatabaseOperation.ReadRun, () =>
    db
      .select({
        ...runTimelineSelection,
        cursorOccurredAt: sql<string>`to_char(${workflowEvents.occurredAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
        cursorReceivedAt: sql<string>`to_char(${workflowEvents.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
      })
      .from(workflowEvents)
      .innerJoin(workflowRuns, eq(workflowEvents.runId, workflowRuns.id))
      .innerJoin(workflows, eq(workflowRuns.workflowId, workflows.id))
      .where(baseWhere)
      .orderBy(
        workflowEvents.occurredAt,
        workflowEvents.createdAt,
        workflowEvents.eventId,
      )
      .limit(limit + 1),
  )
  const hasMore = rows.length > limit
  const pageRows = hasMore ? rows.slice(0, limit) : rows
  const mappedRows: RunTimelineRow[] = pageRows.map((row) => ({
    id: row.id,
    expectation: row.expectation,
    expectationObservedAt: row.expectationObservedAt,
    type: row.type,
    step: row.step,
    operationId: row.operationId,
    attempt: row.attempt,
    retryOf: row.retryOf,
    operationName: row.operationName,
    durationMs: row.durationMs,
    completed: row.completed,
    total: row.total,
    unit: row.unit,
    reason: row.reason,
    properties: row.properties,
    error: row.error,
    result: row.result,
    outcome: row.outcome,
    timestamp: row.timestamp,
    receivedAt: row.receivedAt,
    receiptOrder: row.receiptOrder,
    workflow: row.workflow,
    externalId: row.externalId,
    environment: row.environment,
    release: row.release,
    correlationId: row.correlationId,
    parentRunId: row.parentRunId,
  }))
  const latestReportOrder = yield* runQuery(DatabaseOperation.ReadRun, () =>
    db
      .select({
        latest: sql<number>`coalesce(max(${workflowEvents.receiptOrder}), 0)::int`,
      })
      .from(workflowEvents)
      .where(
        and(
          eq(workflowEvents.runId, query.runId),
          eq(workflowEvents.type, "report"),
        ),
      ),
  ).pipe(Effect.map((result) => result[0]?.latest ?? 0))
  const events = mapRunTimelineRows(mappedRows, latestReportOrder).map(
    (event) => {
      const properties = boundJsonPreview(event.properties)
      const result = boundJsonPreview(event.result)
      const error = boundJsonPreview(event.error)
      const omissions = [
        ...properties.omissions,
        ...result.omissions,
        ...error.omissions,
      ]
      return {
        ...event,
        properties: properties.value as typeof event.properties,
        result: result.value as typeof event.result,
        error: error.value as typeof event.error,
        ...(omissions.length > 0 ? { boundedPreviewOmissions: omissions } : {}),
      }
    },
  )
  const last = pageRows.at(-1)
  const nextCursor =
    hasMore && last
      ? encodeRunEventPageCursor({
          occurredAt: last.cursorOccurredAt,
          receivedAt: last.cursorReceivedAt,
          eventId: last.eventId,
        })
      : null
  return {
    runId: query.runId,
    events,
    nextCursor,
    limit,
    totalEvents: countRow?.total ?? 0,
  } satisfies RunEventPage
})
