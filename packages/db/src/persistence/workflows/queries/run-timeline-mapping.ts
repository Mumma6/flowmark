import { and, eq } from "drizzle-orm"
import type {
  WorkflowAttempt,
  WorkflowRetryReference,
  WorkflowError,
  WorkflowFailure,
  WorkflowProperties,
  WorkflowResult,
} from "@flowmarkdev/core"
import {
  workflowEvents,
  workflowRuns,
  workflows,
} from "../../../schema/index.js"
import type { RunTimelineEvent } from "./get-run-timeline.js"

export type RunTimelineRow = {
  id: string
  expectation: import("@flowmarkdev/core").ExpectationEvent | null
  expectationObservedAt: Date | null
  type: string
  step: string | null
  operationId: string | null
  attempt: WorkflowAttempt | null
  retryOf: WorkflowRetryReference | null
  operationName: string | null
  durationMs: number | null
  completed: number | null
  total: number | null
  unit: string | null
  reason: string | null
  properties: WorkflowProperties | null
  error: WorkflowError | WorkflowFailure | null
  result: WorkflowResult | null
  outcome: string | null
  timestamp: Date
  receivedAt: Date
  receiptOrder: number
  workflow: string
  externalId: string
  environment: string | null
  release: string | null
  correlationId: string | null
  parentRunId: string | null
}

export const runTimelineSelection = {
  id: workflowEvents.eventId,
  expectation: workflowEvents.expectation,
  expectationObservedAt: workflowEvents.expectationObservedAt,
  type: workflowEvents.type,
  step: workflowEvents.step,
  operationId: workflowEvents.operationId,
  operationName: workflowEvents.operationName,
  attempt: workflowEvents.attempt,
  retryOf: workflowRuns.retryOf,
  durationMs: workflowEvents.durationMs,
  completed: workflowEvents.progressCompleted,
  total: workflowEvents.progressTotal,
  unit: workflowEvents.progressUnit,
  reason: workflowEvents.reason,
  properties: workflowEvents.properties,
  error: workflowEvents.error,
  result: workflowEvents.result,
  outcome: workflowEvents.outcome,
  timestamp: workflowEvents.occurredAt,
  receivedAt: workflowEvents.createdAt,
  receiptOrder: workflowEvents.receiptOrder,
  workflow: workflows.name,
  externalId: workflowRuns.externalId,
  environment: workflowRuns.environment,
  release: workflowRuns.release,
  correlationId: workflowRuns.correlationId,
  parentRunId: workflowRuns.parentRunId,
  eventId: workflowEvents.eventId,
  rowId: workflowEvents.id,
} as const

export const runTimelineJoins = (projectId: string, runId: string) =>
  and(eq(workflows.projectId, projectId), eq(workflowRuns.id, runId))

export const mapRunTimelineRows = (
  rows: ReadonlyArray<RunTimelineRow>,
  latestReportOrder: number,
): ReadonlyArray<RunTimelineEvent> =>
  rows.map((row) => ({
    isLatestReport:
      row.type === "report" && row.receiptOrder === latestReportOrder,
    id: row.id,
    expectation: row.expectation ?? null,
    expectationObservedAt: row.expectationObservedAt?.toISOString() ?? null,
    type: row.type,
    step: row.step,
    operationId: row.operationId,
    attempt: row.attempt ?? null,
    retryOf: row.retryOf ?? null,
    operationName: row.operationName,
    durationMs: row.durationMs,
    completed: row.completed,
    total: row.total,
    unit: row.unit,
    reason: row.reason,
    properties: row.properties ?? null,
    error: row.error ?? null,
    result: row.result ?? null,
    outcome: row.outcome ?? null,
    timestamp: row.timestamp.toISOString(),
    receivedAt: (row.expectationObservedAt ?? row.receivedAt).toISOString(),
    receiptOrder: row.receiptOrder,
    workflow: row.workflow,
    externalId: row.externalId,
    environment: row.environment ?? null,
    release: row.release ?? null,
    correlationId: row.correlationId ?? null,
    parentRunId: row.parentRunId ?? null,
  }))

export const latestReportReceiptOrder = (
  rows: ReadonlyArray<Pick<RunTimelineRow, "type" | "receiptOrder">>,
) =>
  rows.reduce(
    (latest, row) =>
      row.type === "report" ? Math.max(latest, row.receiptOrder) : latest,
    0,
  )
