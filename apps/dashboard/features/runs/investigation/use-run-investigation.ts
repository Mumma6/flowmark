"use client"

import { Match, Option } from "effect"
import { useSearchParams } from "next/navigation"
import { useState } from "react"
import {
  evidencePageForSection,
  initialTimelineView,
  interpretRunSelection,
  runSelectionQueryKey,
} from "./investigation-selection"
import { investigationReturn } from "./investigation-navigation"
import type { RunEvent } from "../../platform/api-types"
import { useProject } from "../../projects/project-context"

export function useRunInvestigation({
  runId,
  events,
}: {
  readonly runId: string
  readonly events: readonly RunEvent[]
}) {
  const routeParams = useSearchParams()
  const { current } = useProject()
  const source = routeParams.has("from")
    ? investigationReturn(routeParams.get("from")).href
    : undefined
  const roundTrip = interpretRunSelection({
    raw: routeParams.get(runSelectionQueryKey),
    projectId: current?.id,
    runId,
  })
  const eventsPage = Option.getOrUndefined(
    evidencePageForSection(roundTrip, "events"),
  )
  const operationsPage = Option.getOrUndefined(
    evidencePageForSection(roundTrip, "operations"),
  )
  const expectationsPage = Option.getOrUndefined(
    evidencePageForSection(roundTrip, "expectations"),
  )
  const relatedPage = Option.getOrUndefined(
    evidencePageForSection(roundTrip, "related"),
  )
  const selectionTab =
    roundTrip._tag === "Accepted"
      ? Match.value(roundTrip.selection.section).pipe(
          Match.when("related", () => "related"),
          Match.when("expectations", () => "confirmations"),
          Match.orElse(() => "timeline"),
        )
      : undefined
  const linkedEventId = events.find(
    (event) => event.id === routeParams.get("event"),
  )?.id
  const [evidenceSelection, setEvidenceSelection] = useState<
    { id: string; revision: number } | undefined
  >(linkedEventId ? { id: linkedEventId, revision: 0 } : undefined)
  const [timelineView, setTimelineView] = useState<
    "timeline" | "waterfall" | "events"
  >(initialTimelineView(linkedEventId, roundTrip))
  return {
    source,
    roundTrip,
    eventsPage,
    operationsPage,
    expectationsPage,
    relatedPage,
    selectionTab,
    linkedEventId,
    evidenceSelection,
    setEvidenceSelection,
    timelineView,
    setTimelineView,
  }
}
