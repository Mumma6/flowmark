import { eq } from "drizzle-orm"
import { Effect } from "effect"
import {
  workflowEvents,
  workflowRuns,
  workflows,
} from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import {
  latestReportReceiptOrder,
  mapRunTimelineRows,
  runTimelineJoins,
  runTimelineSelection,
} from "./run-timeline-mapping.js"

export type RunTimelineEvent = {
  expectation?: import("@flowmarkdev/core").ExpectationEvent | null
  expectationObservedAt?: string | null
  id: string
  type: string
  step: string | null
  operationId: string | null
  attempt?: import("@flowmarkdev/core").WorkflowAttempt | null
  retryOf?: import("@flowmarkdev/core").WorkflowRetryReference | null
  operationName: string | null
  durationMs: number | null
  completed: number | null
  total: number | null
  unit: string | null
  reason: string | null
  properties: import("@flowmarkdev/core").WorkflowProperties | null
  error:
    | import("@flowmarkdev/core").WorkflowError
    | import("@flowmarkdev/core").WorkflowFailure
    | null
  outcome?: string | null
  result: import("@flowmarkdev/core").WorkflowResult | null
  timestamp: string
  isLatestReport?: boolean
  receiptOrder?: number
  receivedAt: string
  workflow: string
  externalId: string
  environment: string | null
  release: string | null
  correlationId: string | null
  parentRunId: string | null
  readonly boundedPreviewOmissions?: ReadonlyArray<string>
}

export const getRunTimeline = Effect.fn("getRunTimeline")(function* (
  projectId: string,
  runId: string,
) {
  const db = yield* Database
  const rows = yield* runQuery(DatabaseOperation.ReadRun, () =>
    db
      .select(runTimelineSelection)
      .from(workflowEvents)
      .innerJoin(workflowRuns, eq(workflowEvents.runId, workflowRuns.id))
      .innerJoin(workflows, eq(workflowRuns.workflowId, workflows.id))
      .where(runTimelineJoins(projectId, runId))
      .orderBy(
        workflowEvents.occurredAt,
        workflowEvents.createdAt,
        workflowEvents.eventId,
      ),
  )
  const latestReportOrder = latestReportReceiptOrder(
    rows.map((row) => ({ type: row.type, receiptOrder: row.receiptOrder })),
  )
  return mapRunTimelineRows(
    rows.map((row) => ({
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
    })),
    latestReportOrder,
  )
})
