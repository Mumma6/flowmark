import { Match, Option, pipe } from "effect"
import type { RunEvent } from "../platform/api-types"
import { formatDuration } from "../shared/format"
import { formatReportedProgress } from "./run-presentation"

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
  return Match.value(event.type).pipe(
    Match.when("report", () => "context" as const),
    Match.when("started", () => "start" as const),
    Match.when("step", () => "checkpoint" as const),
    Match.when("properties", () => "context" as const),
    Match.when("progress", () => "progress" as const),
    Match.when("operation_started", () => "operation" as const),
    Match.when("operation_completed", () => "operation" as const),
    Match.when("operation_failed", () => "operation" as const),
    Match.when("error", () =>
      event.error && "handled" in event.error && event.error.handled
        ? ("error" as const)
        : ("terminal-fail" as const),
    ),
    Match.when("failed", () => "terminal-fail" as const),
    Match.when("completed", () => "terminal-done" as const),
    Match.orElse(() => "checkpoint" as const),
  )
}

export function runTimelineMarkerClass(kind: RunTimelineKind) {
  return Match.value(kind).pipe(
    Match.when("start", () => "border-primary/60 bg-background"),
    Match.when(
      "checkpoint",
      () =>
        "border-primary bg-primary/25 shadow-[0_0_8px_hsl(var(--primary)/0.25)]",
    ),
    Match.when("context", () => "border-muted-foreground/35 bg-muted"),
    Match.when("progress", () => "border-info bg-info/35"),
    Match.when("operation", () => "border-info bg-info"),
    Match.when("error", () => "border-warning bg-warning"),
    Match.when("terminal-fail", () => "border-destructive bg-destructive"),
    Match.when(
      "terminal-done",
      () =>
        "border-primary bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.35)]",
    ),
    Match.exhaustive,
  )
}

export function runTimelineStatusClass(kind: RunTimelineKind) {
  return Match.value(kind).pipe(
    Match.when("terminal-done", () => "text-primary"),
    Match.when("error", () => "text-warning"),
    Match.when("terminal-fail", () => "text-destructive"),
    Match.when("operation", () => "text-info"),
    Match.orElse(() => "text-muted-foreground"),
  )
}

export function runTimelineDetail(event: RunEvent): string | null {
  const errorCode = () =>
    event.error && "code" in event.error ? String(event.error.code) : null
  return Match.value(event.type).pipe(
    Match.when("report", () => "Whole business snapshot · non-final"),
    Match.when("step", () => event.step ?? null),
    Match.when("progress", () =>
      pipe(
        Option.fromNullishOr(event.completed),
        Option.map((completed) =>
          formatReportedProgress({
            completed,
            total: event.total,
            unit: event.unit,
          }),
        ),
        Option.getOrNull,
      ),
    ),
    Match.when("error", errorCode),
    Match.when("operation_failed", errorCode),
    Match.when("failed", errorCode),
    Match.when("operation_started", () => event.operationName ?? null),
    Match.when("operation_completed", () => event.operationName ?? null),
    Match.when("properties", () =>
      pipe(
        Option.fromNullishOr(event.properties),
        Option.filter((value) => typeof value === "object"),
        Option.map((value) => `${Object.keys(value).length} fields`),
        Option.getOrElse(() => "Context updated"),
      ),
    ),
    Match.when("completed", () =>
      event.result != null ? "Result recorded" : "Completed",
    ),
    Match.orElse(() => null),
  )
}

export function runTimelineStatus(event: RunEvent) {
  const duration = (fallback: string) =>
    pipe(
      Option.fromNullishOr(event.durationMs),
      Option.map(formatDuration),
      Option.getOrElse(() => fallback),
    )
  return Match.value(event.type).pipe(
    Match.when("operation_started", () => "Started"),
    Match.when("operation_completed", () => duration("Completed")),
    Match.when("operation_failed", () => duration("Failed")),
    Match.orElse(
      () => runTimelineDetail(event) ?? event.type.replaceAll("_", " "),
    ),
  )
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
