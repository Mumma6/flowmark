"use client"

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@flowmark/ui"
import { RunOperationsPagePanel } from "../panels/run-operations-page-panel"
import { RunAttempts } from "../panels/run-attempts"
import { RunEventPagePanel } from "../panels/run-event-page-panel"
import { RunEventTimeline } from "../../timeline/run-event-timeline"
import type { InvestigationSectionProps } from "../investigation-types"

export function TimelineSection({
  eventsPage,
  operationsPage,
  evidenceSelection,
  setEvidenceSelection,
  timelineView,
  setTimelineView,
  runId,
  events,
}: Pick<
  InvestigationSectionProps,
  | "eventsPage"
  | "operationsPage"
  | "evidenceSelection"
  | "setEvidenceSelection"
  | "timelineView"
  | "setTimelineView"
  | "runId"
  | "events"
>) {
  return (
    <>
      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>
              {timelineView === "waterfall"
                ? "Operation waterfall"
                : timelineView === "events"
                  ? "Event table"
                  : "Event timeline"}
            </CardTitle>
            <CardDescription className="mt-2">
              {timelineView === "waterfall"
                ? "Recorded operations load in bounded pages. Use the event timeline for full interval overlap."
                : timelineView === "events"
                  ? "Filter and expand rows for full payloads and timestamps."
                  : "Checkpoints, operations, progress, and failures in order. Expand rows with payloads."}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={timelineView === "timeline" ? "secondary" : "outline"}
              aria-pressed={timelineView === "timeline"}
              onClick={() => setTimelineView("timeline")}
            >
              Timeline
            </Button>
            <Button
              type="button"
              size="sm"
              variant={timelineView === "waterfall" ? "secondary" : "outline"}
              aria-pressed={timelineView === "waterfall"}
              onClick={() => setTimelineView("waterfall")}
            >
              Operations
            </Button>
            <Button
              type="button"
              size="sm"
              variant={timelineView === "events" ? "secondary" : "outline"}
              aria-pressed={timelineView === "events"}
              onClick={() => setTimelineView("events")}
            >
              Table
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <RunAttempts
            events={events}
            onEvidence={(id) => {
              setEvidenceSelection((previous) => ({
                id,
                revision: (previous?.revision ?? 0) + 1,
              }))
              setTimelineView("events")
              requestAnimationFrame(() =>
                document
                  .getElementById(`event-${id}`)
                  ?.scrollIntoView({ block: "center" }),
              )
            }}
          />
          {timelineView === "waterfall" ? (
            <RunOperationsPagePanel runId={runId} page={operationsPage} />
          ) : timelineView === "events" ? (
            <RunEventPagePanel
              runId={runId}
              initialEventId={evidenceSelection?.id}
              page={eventsPage}
            />
          ) : (
            <RunEventTimeline events={events} />
          )}
        </CardContent>
      </Card>
    </>
  )
}
