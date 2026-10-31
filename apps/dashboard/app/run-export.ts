import {
  getRunDurationMs,
  getRunResultHighlights,
  latestReportedProgress,
} from "./run-presentation"

export interface ExportableRunEvent {
  readonly expectation?: unknown
  readonly expectationObservedAt?: string | null
  readonly id: string
  readonly type: string
  readonly step: string | null
  readonly operationId: string | null
  readonly attempt?: {
    readonly groupId: string
    readonly number: number
  } | null
  readonly retryOf?: {
    readonly workflow: string
    readonly runId: string
  } | null
  readonly operationName: string | null
  readonly durationMs: number | null
  readonly completed: number | null
  readonly total: number | null
  readonly unit: string | null
  readonly reason: string | null
  readonly properties: Record<string, unknown> | null
  readonly error: unknown
  readonly outcome?: string | null
  readonly result: Record<string, unknown> | null
  readonly timestamp: string
  readonly receiptOrder?: number
  readonly isLatestReport?: boolean
  readonly receivedAt: string
  readonly workflow: string
  readonly externalId: string
  readonly environment: string | null
  readonly release: string | null
  readonly correlationId: string | null
  readonly parentRunId: string | null
}

function runStatus(
  events: ReadonlyArray<ExportableRunEvent>,
): "Completed" | "Failed" | "Running" {
  if (events.some((event) => event.type === "failed")) {
    return "Failed"
  }
  if (events.some((event) => event.type === "completed")) {
    return "Completed"
  }
  return "Running"
}

function mergedContext(
  events: ReadonlyArray<ExportableRunEvent>,
): Record<string, unknown> {
  const context = new Map<string, unknown>()
  for (const event of events) {
    if (event.type === "started" || event.type === "properties") {
      for (const [key, value] of Object.entries(event.properties ?? {})) {
        context.set(key, value)
      }
    }
  }
  return Object.fromEntries(context)
}

function reportedResult(
  events: ReadonlyArray<ExportableRunEvent>,
): Record<string, unknown> | null {
  const failure = events.find((event) => event.type === "failed")
  if (failure?.result) {
    return failure.result
  }
  const completed = [...events]
    .reverse()
    .find((event) => event.type === "completed")
  return completed?.result ?? null
}

/** Stable summary for clipboard / agent paste. Not a wire format. */
export function buildRunExport(events: ReadonlyArray<ExportableRunEvent>) {
  const first = events[0]
  if (!first) {
    return null
  }
  const result = reportedResult(events)
  const progress = latestReportedProgress(events)
  return {
    workflow: first.workflow,
    externalId: first.externalId,
    status: runStatus(events),
    startedAt: first.timestamp,
    durationMs: getRunDurationMs(events),
    environment: first.environment,
    release: first.release,
    correlationId: first.correlationId,
    parentRunId: first.parentRunId,
    retryOf: first.retryOf ?? null,
    context: mergedContext(events),
    outcome:
      (
        events.find((event) => event.type === "failed") ??
        [...events].reverse().find((event) => event.type === "completed")
      )?.outcome ?? null,
    result,
    resultHighlights: result ? getRunResultHighlights(result) : [],
    lastReportedProgress: progress ?? null,
    lastReportedBusinessWork:
      events.find((event) => event.type === "report" && event.isLatestReport) ??
      null,
    eventCount: events.length,
    operationCount: events.filter((event) => event.type === "operation_started")
      .length,
    failedOperationCount: events.filter(
      (event) => event.type === "operation_failed",
    ).length,
    errorCount: events.filter((event) => event.type === "error").length,
  }
}

/** Full ordered timeline for clipboard. Payloads as recorded. */
export function buildTimelineExport(events: ReadonlyArray<ExportableRunEvent>) {
  const first = events[0]
  if (!first) {
    return null
  }
  return {
    workflow: first.workflow,
    externalId: first.externalId,
    status: runStatus(events),
    retryOf: first.retryOf ?? null,
    events: events.map((event) => ({
      id: event.id,
      expectation: event.expectation ?? null,
      expectationObservedAt: event.expectationObservedAt ?? null,
      type: event.type,
      timestamp: event.timestamp,
      receivedAt: event.receivedAt,
      receiptOrder: event.receiptOrder,
      isLatestReport: event.isLatestReport,
      step: event.step,
      operationId: event.operationId,
      operationName: event.operationName,
      attempt: event.attempt ?? null,
      durationMs: event.durationMs,
      completed: event.completed,
      total: event.total,
      unit: event.unit,
      reason: event.reason,
      properties: event.properties,
      error: event.error,
      result: event.result,
      outcome: event.outcome ?? null,
    })),
  }
}

export function stringifyExport(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`
}
