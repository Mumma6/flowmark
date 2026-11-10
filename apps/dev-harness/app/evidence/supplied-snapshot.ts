import type { RunSnapshotProps } from "@flowmark/ui"
export { decodeSuppliedSnapshot } from "@flowmark/evidence-view/snapshot"

export const exampleSnapshot = {
  workflow: "synthetic.customer-import",
  externalId: "Internal run: synthetic-run-1",
  startedAt: "2026-11-10T09:00:00.000Z",
  duration: "Not reported",
  status: "No final outcome",
  metrics: [],
  milestones: [
    {
      id: "synthetic-event-1",
      label: "progress",
      kind: "progress",
      time: "2026-11-10T09:00:01.000Z",
      title: "Recorded progress event",
      description:
        "Synthetic example. Progress values and application payload are withheld.",
      payload: '{"id":"synthetic-event-1","type":"progress"}',
      note: "Event reference: synthetic-event-1",
    },
  ],
  emptyResult:
    "Business result, external ID and raw payloads are withheld. No terminal outcome was supplied.",
  evidenceNote:
    "Synthetic example · Project reference: synthetic-project. Run reference: synthetic-run-1. Showing 1 of 2 events in one page; 12 events recorded. Other pages omitted. Supplied evidence, not a live view.",
} satisfies Omit<RunSnapshotProps, "actions">
