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
