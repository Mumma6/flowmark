export type RunStatus = "Completed" | "Failed" | "Running"

export interface RunResultHighlight {
  readonly key: string
  readonly label: string
  readonly value: string
}

export interface RunProgressEvent {
  readonly type: string
  readonly completed?: number | null
  readonly total?: number | null
  readonly unit?: string | null
}

export interface ReportedProgress {
  readonly completed: number
  readonly total?: number | null
  readonly unit?: string | null
}

const MAX_RESULT_HIGHLIGHTS = 4

export function runStatusLabel(status: RunStatus) {
  return status === "Running" ? "No final outcome" : status
}

export function getRunDurationMs(
  events: ReadonlyArray<{ readonly type: string; readonly timestamp: string }>,
): number | null {
  const started = events.find((event) => event.type === "started")
  if (!started) {
    return null
  }
  const start = Date.parse(started.timestamp)
  let duration: number | null = null
  for (const event of events) {
    if (event.type === "completed" || event.type === "failed") {
      const elapsed = Date.parse(event.timestamp) - start
      duration = duration === null ? elapsed : Math.max(duration, elapsed)
    }
  }
  return duration
}

export function latestReportedProgress(
  events: ReadonlyArray<RunProgressEvent>,
): ReportedProgress | undefined {
  const event = [...events]
    .reverse()
    .find((item) => item.type === "progress" && item.completed != null)
  return event?.completed == null
    ? undefined
    : {
        completed: event.completed,
        total: event.total,
        unit: event.unit,
      }
}

export function formatReportedProgress(progress: ReportedProgress) {
  return `${progress.completed}${progress.total != null ? ` / ${progress.total}` : ""}${progress.unit ? ` ${progress.unit}` : ""}`
}

export function getRunResultHighlights(
  result: Readonly<Record<string, unknown>>,
): ReadonlyArray<RunResultHighlight> {
  return Object.entries(result)
    .filter(
      ([, value]) =>
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean",
    )
    .slice(0, MAX_RESULT_HIGHLIGHTS)
    .map(([key, value]) => ({
      key,
      label: key
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase()),
      value: String(value),
    }))
}

export type OperationSpanStatus = "completed" | "failed" | "open"

export interface OperationSpan {
  readonly operationId: string
  readonly name: string
  readonly startedAt: string
  readonly endedAt: string | null
  readonly durationMs: number | null
  readonly status: OperationSpanStatus
  readonly offsetMs: number
  readonly error: unknown
}

export interface ProgressPoint {
  readonly timestamp: string
  readonly offsetMs: number
  readonly completed: number
  readonly total?: number | null
  readonly unit?: string | null
}

function runStartMs(
  events: ReadonlyArray<{ readonly type: string; readonly timestamp: string }>,
): number | null {
  const started = events.find((event) => event.type === "started")
  return started ? Date.parse(started.timestamp) : null
}

/** Pair operation_started with completed/failed by operationId. */
export function buildOperationSpans(
  events: ReadonlyArray<{
    readonly type: string
    readonly timestamp: string
    readonly operationId?: string | null
    readonly operationName?: string | null
    readonly durationMs?: number | null
    readonly error?: unknown
  }>,
): ReadonlyArray<OperationSpan> {
  const startMs = runStartMs(events)
  if (startMs == null) {
    return []
  }
  const byId = new Map<
    string,
    {
      name: string
      startedAt: string
      endedAt: string | null
      durationMs: number | null
      status: OperationSpanStatus
      error: unknown
    }
  >()
  for (const event of events) {
    const id = event.operationId
    if (!id) {
      continue
    }
    if (event.type === "operation_started") {
      byId.set(id, {
        name: event.operationName ?? "Operation",
        startedAt: event.timestamp,
        endedAt: null,
        durationMs: null,
        status: "open",
        error: null,
      })
      continue
    }
    const existing = byId.get(id)
    if (!existing) {
      continue
    }
    if (event.type === "operation_completed") {
      byId.set(id, {
        ...existing,
        endedAt: event.timestamp,
        durationMs:
          event.durationMs ??
          Date.parse(event.timestamp) - Date.parse(existing.startedAt),
        status: "completed",
      })
    } else if (event.type === "operation_failed") {
      byId.set(id, {
        ...existing,
        endedAt: event.timestamp,
        durationMs:
          event.durationMs ??
          Date.parse(event.timestamp) - Date.parse(existing.startedAt),
        status: "failed",
        error: event.error ?? null,
      })
    }
  }
  return [...byId.entries()]
    .map(([operationId, span]) => ({
      operationId,
      name: span.name,
      startedAt: span.startedAt,
      endedAt: span.endedAt,
      durationMs: span.durationMs,
      status: span.status,
      offsetMs: Math.max(0, Date.parse(span.startedAt) - startMs),
      error: span.error,
    }))
    .sort(
      (a, b) =>
        Date.parse(a.startedAt) - Date.parse(b.startedAt) ||
        a.operationId.localeCompare(b.operationId),
    )
}

export function buildProgressSeries(
  events: ReadonlyArray<{
    readonly type: string
    readonly timestamp: string
    readonly completed?: number | null
    readonly total?: number | null
    readonly unit?: string | null
  }>,
): ReadonlyArray<ProgressPoint> {
  const startMs = runStartMs(events)
  if (startMs == null) {
    return []
  }
  return events
    .filter((event) => event.type === "progress" && event.completed != null)
    .map((event) => ({
      timestamp: event.timestamp,
      offsetMs: Math.max(0, Date.parse(event.timestamp) - startMs),
      completed: event.completed as number,
      total: event.total,
      unit: event.unit,
    }))
}

/** Idle gaps between consecutive recorded operation endpoints (ms). */
export function operationIdleGaps(
  spans: ReadonlyArray<OperationSpan>,
): ReadonlyArray<{
  readonly afterOperationId: string
  readonly idleMs: number
}> {
  const finished = spans
    .filter((span) => span.endedAt != null)
    .sort(
      (a, b) =>
        Date.parse(a.endedAt!) - Date.parse(b.endedAt!) ||
        a.operationId.localeCompare(b.operationId),
    )
  const gaps: { afterOperationId: string; idleMs: number }[] = []
  for (let index = 0; index < finished.length - 1; index += 1) {
    const current = finished[index]!
    const next = finished[index + 1]!
    const idleMs = Date.parse(next.startedAt) - Date.parse(current.endedAt!)
    if (idleMs > 0) {
      gaps.push({ afterOperationId: current.operationId, idleMs })
    }
  }
  return gaps
}
