"use client"

import { Match } from "effect"
import { useState } from "react"
import { Badge, Button } from "@flowmark/ui"
import { ChevronDown, ChevronRight } from "lucide-react"
import { formatDuration } from "./dashboard-data"
import { formatReportedProgress } from "./run-presentation"
import { eventLabel, JsonData, type RunEvent } from "./run-event-table"

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

function runTimelineStatus(event: RunEvent) {
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

function hasExpandablePayload(event: RunEvent) {
  return Boolean(
    event.outcome ||
    event.error ||
    event.expectation ||
    event.properties ||
    event.result != null ||
    event.reason,
  )
}

export function RunEventTimeline({ events }: { events: readonly RunEvent[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const startMs = events[0] ? Date.parse(events[0].timestamp) : null

  if (events.length === 0) {
    return (
      <p className="px-5 py-6 text-sm leading-6 text-muted-foreground">
        No telemetry recorded for this run yet.
      </p>
    )
  }

  return (
    <div className="grid gap-4 p-5">
      <p className="text-xs leading-6 text-muted-foreground">
        Every persisted event in order. Checkpoints, progress snapshots, and
        errors appear here; use Operations for measured operation() intervals
        only.
      </p>
      <ol className="relative grid gap-0 p-0" aria-label="Run event timeline">
        <span
          className="absolute top-3 bottom-3 left-[5px] w-px bg-primary/30"
          aria-hidden="true"
        />
        {events.map((event) => {
          const kind = getRunTimelineKind(event)
          const status = runTimelineStatus(event)
          const detail = runTimelineDetail(event)
          const expandable = hasExpandablePayload(event)
          const elapsedMs =
            startMs == null
              ? null
              : Math.max(0, Date.parse(event.timestamp) - startMs)

          return (
            <li
              key={event.id}
              className="relative grid min-h-10 grid-cols-[12px_minmax(0,1fr)_auto] items-start gap-3 py-2"
            >
              <span
                className={`relative z-10 mt-1 size-[11px] shrink-0 rounded-full border ${runTimelineMarkerClass(kind)}`}
                aria-hidden="true"
              />
              <div className="grid min-w-0 gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  {expandable ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-2 h-8 px-2 font-medium"
                      aria-expanded={expanded === event.id}
                      aria-controls={`timeline-${event.id}`}
                      onClick={() =>
                        setExpanded(expanded === event.id ? null : event.id)
                      }
                    >
                      {expanded === event.id ? (
                        <ChevronDown aria-hidden="true" className="size-4" />
                      ) : (
                        <ChevronRight aria-hidden="true" className="size-4" />
                      )}
                      {eventLabel(event)}
                    </Button>
                  ) : (
                    <span className="text-sm font-medium">
                      {eventLabel(event)}
                    </span>
                  )}
                  {event.type === "operation_failed" ||
                  (event.type === "error" &&
                    event.error &&
                    "handled" in event.error &&
                    event.error.handled) ? (
                    <Badge
                      variant="outline"
                      className="border-warning text-warning"
                    >
                      Handled
                    </Badge>
                  ) : null}
                  {event.type === "failed" ||
                  event.type === "operation_failed" ? (
                    <Badge variant="destructive">Failed</Badge>
                  ) : null}
                </div>
                {detail != null &&
                  detail !== status &&
                  !event.type.startsWith("operation_") && (
                    <p className="break-all pl-0 text-xs text-muted-foreground">
                      {detail}
                    </p>
                  )}
                {expanded === event.id && (
                  <div id={`timeline-${event.id}`} className="grid gap-3 pt-2">
                    {event.outcome != null && (
                      <p className="text-sm">
                        Business outcome: {event.outcome}
                      </p>
                    )}
                    {event.error && <JsonData value={event.error} />}
                    {!event.error && event.reason && (
                      <p className="text-xs leading-6">{event.reason}</p>
                    )}
                    {event.expectation && (
                      <JsonData
                        value={{
                          eventId: event.id,
                          observedAt: event.expectationObservedAt,
                          event: event.expectation,
                        }}
                      />
                    )}
                    {event.properties && <JsonData value={event.properties} />}
                    {event.result != null && <JsonData value={event.result} />}
                  </div>
                )}
              </div>
              <span
                className={`pt-0.5 font-mono text-[11px] tabular-nums whitespace-nowrap ${runTimelineStatusClass(kind)}`}
              >
                {elapsedMs != null ? `+${formatDuration(elapsedMs)}` : status}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
