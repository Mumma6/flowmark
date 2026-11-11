"use client"

import { Badge, Button } from "@flowmark/ui"
import { ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"
import { JsonData } from "../../shared/json-data"
import type { RunEvent } from "../../platform/api-types"
import { formatDuration } from "../../shared/format"
import { eventLabel } from "./event-label"
import {
  getRunTimelineKind,
  hasExpandablePayload,
  runTimelineDetail,
  runTimelineMarkerClass,
  runTimelineStatus,
  runTimelineStatusClass,
} from "./timeline-presentation"

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
          className="absolute top-3 bottom-3 left-[5px] w-px bg-highlight/30"
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
