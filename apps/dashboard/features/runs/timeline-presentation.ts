import { Match } from "effect"
import type { RunEvent } from "../../lib/api/types"
import { formatDuration } from "../../lib/format"
import { formatReportedProgress } from "../../lib/telemetry/run-presentation"

export type RunTimelineKind =
  | "start"
  | "checkpoint"
  | "context"
  | "progress"
  | "operation"
  | "error"
  | "terminal-fail"
  | "terminal-done"

export function getRunTimelineKind(event: RunEvent): RunTimelineKind {
  if (event.type === "report") {
    return "context"
  }
  switch (event.type) {
    case "started":
      return "start"
    case "step":
      return "checkpoint"
    case "properties":
      return "context"
    case "progress":
      return "progress"
    case "operation_started":
    case "operation_completed":
    case "operation_failed":
      return "operation"
    case "error":
      return event.error && "handled" in event.error && event.error.handled
        ? "error"
        : "terminal-fail"
    case "failed":
      return "terminal-fail"
    case "completed":
      return "terminal-done"
    default:
      return "checkpoint"
  }
}

export function runTimelineMarkerClass(kind: RunTimelineKind) {
  switch (kind) {
    case "start":
      return "border-primary/60 bg-background"
    case "checkpoint":
      return "border-primary bg-primary/25 shadow-[0_0_8px_hsl(var(--primary)/0.25)]"
    case "context":
      return "border-muted-foreground/35 bg-muted"
    case "progress":
      return "border-info bg-info/35"
    case "operation":
      return "border-info bg-info"
    case "error":
      return "border-warning bg-warning"
    case "terminal-fail":
      return "border-destructive bg-destructive"
    case "terminal-done":
      return "border-primary bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.35)]"
  }
}

export function runTimelineStatusClass(kind: RunTimelineKind) {
  switch (kind) {
    case "terminal-done":
      return "text-primary"
    case "error":
      return "text-warning"
    case "terminal-fail":
      return "text-destructive"
    case "operation":
      return "text-info"
    default:
      return "text-muted-foreground"
  }
}

export function runTimelineDetail(event: RunEvent): string | null {
  const report = Match.value(event).pipe(
    Match.when({ type: "report" }, () => "Whole business snapshot · non-final"),
    Match.orElse(() => null),
  )
  if (report !== null) {
    return report
  }
  switch (event.type) {
    case "step":
      return event.step ?? null
    case "progress":
      if (event.completed == null) {
        return null
      }
      return formatReportedProgress({
        completed: event.completed,
        total: event.total,
        unit: event.unit,
      })
    case "error":
    case "operation_failed":
    case "failed":
      return event.error && "code" in event.error
        ? String(event.error.code)
        : null
    case "operation_started":
    case "operation_completed":
      return event.operationName ?? null
    case "properties":
      return event.properties && typeof event.properties === "object"
        ? `${Object.keys(event.properties as object).length} fields`
        : "Context updated"
    case "completed":
      return event.result != null ? "Result recorded" : "Completed"
    default:
      return null
  }
}

export function runTimelineStatus(event: RunEvent) {
  if (event.type === "operation_started") {
    return "Started"
  }
  if (event.type === "operation_completed") {
    return event.durationMs != null
      ? formatDuration(event.durationMs)
      : "Completed"
  }
  if (event.type === "operation_failed") {
    return event.durationMs != null
      ? formatDuration(event.durationMs)
      : "Failed"
  }
  const detail = runTimelineDetail(event)
  return detail ?? event.type.replaceAll("_", " ")
}

export function hasExpandablePayload(event: RunEvent) {
  return Boolean(
    event.outcome ||
    event.error ||
    event.expectation ||
    event.properties ||
    event.result != null ||
    event.reason,
  )
}
