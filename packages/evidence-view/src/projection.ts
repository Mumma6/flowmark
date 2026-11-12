import type { RunSnapshotProps, RunSnapshotMilestone } from "@flowmark/ui"
import * as Array from "effect/Array"
import * as Match from "effect/Match"
import { pipe } from "effect/Function"

export interface EvidenceSummary {
  readonly id: string
  readonly workflow: string
  readonly startedAt: string
  readonly durationMs: number | null
  readonly status: "Running" | "Completed" | "Failed"
}
export interface EvidencePage {
  readonly runId: string
  readonly events: readonly {
    readonly id: string
    readonly type: string
    readonly timestamp: string
  }[]
  readonly limit: number
  readonly totalEvents: number
  readonly nextCursor: string | null
}
const formatDuration = (value: number) =>
  value < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(2)} s`

/** Metadata only: never copy application payloads or credentials into the host. */
export function buildSuppliedRunSnapshot(
  projectId: string,
  summary: EvidenceSummary,
  page: EvidencePage,
  continuation: boolean,
): Omit<RunSnapshotProps, "actions"> | null {
  if (summary.id !== page.runId) {
    return null
  }
  const milestones = pipe(
    page.events,
    Array.take(8),
    Array.map((event): RunSnapshotMilestone => ({
      id: event.id,
      label: event.type,
      kind: Match.value(event.type).pipe(
        Match.when("completed", () => "completed" as const),
        Match.when("failed", () => "failed" as const),
        Match.when("error", () => "error" as const),
        Match.when("operation_failed", () => "error" as const),
        Match.when("progress", () => "progress" as const),
        Match.orElse(() => "checkpoint" as const),
      ),
      time: event.timestamp,
      title: `Recorded ${event.type} event`,
      description:
        "Metadata from the supplied event page. Application payload and progress values are withheld; this event does not determine the run's current state.",
      payload: JSON.stringify(
        { id: event.id, type: event.type, timestamp: event.timestamp },
        null,
        2,
      ),
      note: `Event reference: ${event.id}`,
    })),
  )
  return {
    workflow: summary.workflow,
    externalId: `Internal run: ${summary.id}`,
    startedAt: summary.startedAt,
    duration:
      summary.durationMs == null
        ? "Not reported"
        : formatDuration(summary.durationMs),
    status: summary.status === "Running" ? "No final outcome" : summary.status,
    metrics: [],
    milestones,
    emptyResult:
      "Business result, external ID, environment, release and raw payloads are withheld from this metadata-only snapshot. Completion does not mean every record succeeded.",
    evidenceNote: `Project reference: ${projectId}. Run reference: ${summary.id}. Showing ${milestones.length} of ${page.events.length} events in one ${continuation ? "continuation" : "initial"} page (limit ${page.limit}); ${page.totalEvents} events recorded at page retrieval. ${page.nextCursor ? "More pages exist." : "No later page at retrieval."} Only these event metadata are included; other pages and events beyond the first 8, if any, are omitted. Summary and page are separate reads; this is supplied evidence, not a live view.`,
  }
}
