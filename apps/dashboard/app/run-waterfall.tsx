"use client"

import { Badge } from "@flowmark/ui"
import {
  buildOperationSpans,
  buildProgressSeries,
  formatReportedProgress,
  operationIdleGaps,
  type OperationSpan,
} from "./run-presentation"
import { formatDuration } from "./dashboard-data"
import type { RunEvent } from "./run-event-table"

function spanWidthPercent(span: OperationSpan, totalMs: number) {
  if (totalMs <= 0) {
    return 100
  }
  const duration =
    span.durationMs ??
    (span.endedAt
      ? Date.parse(span.endedAt) - Date.parse(span.startedAt)
      : Math.max(1, totalMs - span.offsetMs))
  return Math.max(1.5, Math.min(100, (duration / totalMs) * 100))
}

function spanOffsetPercent(span: OperationSpan, totalMs: number) {
  if (totalMs <= 0) {
    return 0
  }
  return Math.min(98, (span.offsetMs / totalMs) * 100)
}

function barClass(status: OperationSpan["status"]) {
  switch (status) {
    case "failed":
      return "bg-destructive"
    case "open":
      return "bg-muted-foreground/50"
    default:
      return "bg-success"
  }
}

export function ProgressStrip({ events }: { events: readonly RunEvent[] }) {
  const points = buildProgressSeries(events)
  if (points.length === 0) {
    return null
  }
  const last = points[points.length - 1]!
  const maxTotal = Math.max(
    ...points.map((point) => point.total ?? point.completed),
    1,
  )
  return (
    <div className="grid gap-3">
      <p className="text-sm">
        <strong>Progress history:</strong> {points.length} snapshots · last{" "}
        {formatReportedProgress(last)}
      </p>
      <ol className="grid gap-2" aria-label="Reported progress over time">
        {points.map((point) => (
          <li
            key={`${point.timestamp}-${point.completed}`}
            className="grid gap-1"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground">
              <span>+{formatDuration(point.offsetMs)}</span>
              <span>{formatReportedProgress(point)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/80"
                style={{
                  width: `${Math.min(100, (point.completed / maxTotal) * 100)}%`,
                }}
              />
            </div>
          </li>
        ))}
      </ol>
      <p className="text-xs leading-6 text-muted-foreground">
        Progress is the last absolute snapshot the application reported. It is
        not a heartbeat or proof the run is still active.
      </p>
    </div>
  )
}

export function OperationWaterfall({
  events,
}: {
  events: readonly RunEvent[]
}) {
  const spans = buildOperationSpans(events)
  const gaps = operationIdleGaps(spans)
  const gapById = new Map(gaps.map((gap) => [gap.afterOperationId, gap.idleMs]))
  if (spans.length === 0) {
    return (
      <p className="px-5 py-6 text-sm leading-6 text-muted-foreground">
        No measured operations on this run. Wrap work in{" "}
        <code>operation()</code> to see timing here.
      </p>
    )
  }
  const endMs = Math.max(
    ...spans.map((span) => {
      if (span.endedAt) {
        return Date.parse(span.endedAt)
      }
      return Date.parse(span.startedAt) + (span.durationMs ?? 0)
    }),
    ...events.map((event) => Date.parse(event.timestamp)),
  )
  const startMs = Date.parse(
    events.find((event) => event.type === "started")?.timestamp ??
      spans[0]!.startedAt,
  )
  const totalMs = Math.max(1, endMs - startMs)
  return (
    <div className="grid gap-4 p-5">
      <p className="text-xs leading-6 text-muted-foreground">
        Recorded operation intervals. Overlap is allowed. A failed operation
        does not by itself fail the run. Idle gaps are time between recorded
        endpoints, not proof of wait or blockage.
      </p>
      <ul className="grid gap-4" aria-label="Operation waterfall">
        {spans.map((span) => (
          <li key={span.operationId} className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="break-all font-medium">{span.name}</span>
              <Badge
                variant={
                  span.status === "failed"
                    ? "destructive"
                    : span.status === "open"
                      ? "secondary"
                      : "success"
                }
              >
                {span.status === "open" ? "No recorded end" : span.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                +{formatDuration(span.offsetMs)}
                {span.durationMs != null
                  ? ` · ${formatDuration(span.durationMs)}`
                  : ""}
              </span>
            </div>
            <div className="relative h-3 overflow-hidden rounded-full bg-muted">
              <div
                className={`absolute top-0 h-full rounded-full ${barClass(span.status)}`}
                style={{
                  left: `${spanOffsetPercent(span, totalMs)}%`,
                  width: `${spanWidthPercent(span, totalMs)}%`,
                }}
                title={`${span.name}: ${formatDuration(span.durationMs)}`}
              />
            </div>
            {gapById.get(span.operationId) != null && (
              <p className="text-xs text-muted-foreground">
                Idle before next recorded operation:{" "}
                {formatDuration(gapById.get(span.operationId) ?? null)}
              </p>
            )}
            {span.status === "failed" && span.error != null && (
              <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-3 text-xs leading-6">
                {JSON.stringify(span.error, null, 2)}
              </pre>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
