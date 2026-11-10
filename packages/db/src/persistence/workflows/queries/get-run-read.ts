import type { RunReadInput, RunReadResponse } from "@flowmarkdev/core"
import { and, eq, sql } from "drizzle-orm"
import { Effect } from "effect"
import {
  workflowEvents,
  workflowRuns,
  workflows,
} from "../../../schema/index.js"
import { Database, MissingRunError } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import {
  decodeRunEventPageCursor,
  encodeRunEventPageCursor,
} from "../run-event-page-cursor.js"
import { InvalidRunReadCursor } from "../public-read-errors.js"
import { projectRunSummaries } from "../sql/run-summaries.js"
import { runTimelineJoins } from "./run-timeline-mapping.js"

/** Metadata-only projection: no event/run JSON crosses the database boundary. */
export const getRunRead = Effect.fn("getRunRead")(function* (
  projectId: string,
  input: RunReadInput,
) {
  const db = yield* Database
  const read = <A>(query: () => Promise<A>) =>
    runQuery(DatabaseOperation.ReadRun, query)
  const run = yield* read(() =>
    db
      .select({ id: workflowRuns.id })
      .from(workflowRuns)
      .innerJoin(workflows, eq(workflowRuns.workflowId, workflows.id))
      .where(
        and(
          eq(workflows.projectId, projectId),
          eq(workflowRuns.id, input.runId),
        ),
      )
      .limit(1),
  )
  if (run.length === 0) {
    return yield* new MissingRunError({ runId: input.runId })
  }
  const cursor = decodeRunEventPageCursor(input.cursor)
  if (input.cursor) {
    if (
      !cursor ||
      !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(cursor.eventId) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(
        cursor.occurredAt,
      ) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(cursor.receivedAt)
    ) {
      return yield* new InvalidRunReadCursor()
    }
    // Compare canonical SQL strings: invalid calendar dates and modified timestamps
    // fail without casting caller strings into a timestamp or rounding microseconds.
    const anchors = yield* read(() =>
      db
        .select({ id: workflowEvents.eventId })
        .from(workflowEvents)
        .innerJoin(workflowRuns, eq(workflowEvents.runId, workflowRuns.id))
        .innerJoin(workflows, eq(workflowRuns.workflowId, workflows.id))
        .where(
          and(
            runTimelineJoins(projectId, input.runId),
            eq(workflowEvents.eventId, cursor.eventId),
            sql`to_char(${workflowEvents.occurredAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') = ${cursor.occurredAt}`,
            sql`to_char(${workflowEvents.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') = ${cursor.receivedAt}`,
          ),
        )
        .limit(1),
    )
    if (anchors.length === 0) {
      return yield* new InvalidRunReadCursor()
    }
  }
  const [summary] = yield* read(() =>
    db.execute<RunReadResponse["summary"]>(sql`
    ${projectRunSummaries(projectId, { runId: input.runId })}
    SELECT id, workflow, status,
      to_char("startedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "startedAt",
      "durationMs", (SELECT count(*)::int FROM workflow_events WHERE run_id = runs.id) AS "eventCount"
    FROM runs LIMIT 1
  `),
  )
  if (!summary) {
    return yield* new MissingRunError({ runId: input.runId })
  }
  const limit = input.limit ?? 50
  const rows = yield* read(() =>
    db
      .select({
        id: workflowEvents.eventId,
        type: workflowEvents.type,
        durationMs: workflowEvents.durationMs,
        timestamp: sql<string>`to_char(${workflowEvents.occurredAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
        receivedAt: sql<string>`to_char(${workflowEvents.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
      })
      .from(workflowEvents)
      .innerJoin(workflowRuns, eq(workflowEvents.runId, workflowRuns.id))
      .innerJoin(workflows, eq(workflowRuns.workflowId, workflows.id))
      .where(
        and(
          runTimelineJoins(projectId, input.runId),
          cursor
            ? sql`(${workflowEvents.occurredAt}, ${workflowEvents.createdAt}, ${workflowEvents.eventId}) > (${cursor.occurredAt}::timestamptz, ${cursor.receivedAt}::timestamptz, ${cursor.eventId}::uuid)`
            : undefined,
        ),
      )
      .orderBy(
        workflowEvents.occurredAt,
        workflowEvents.createdAt,
        workflowEvents.eventId,
      )
      .limit(limit + 1),
  )
  const page = rows.slice(0, limit)
  const last = page.at(-1)
  return {
    summary,
    page: {
      events: page.map((event) => ({
        id: event.id,
        type: event.type,
        durationMs: event.durationMs,
        timestamp: new Date(event.timestamp).toISOString(),
      })),
      limit,
      totalEvents: summary.eventCount,
      nextCursor:
        rows.length > limit && last
          ? encodeRunEventPageCursor({
              occurredAt: last.timestamp,
              receivedAt: last.receivedAt,
              eventId: last.id,
            })
          : null,
    },
  }
})
