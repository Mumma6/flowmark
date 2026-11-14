import type { RunSnapshotProps } from "@flowmark/ui"

// Fixed fictional evidence. No health records, credentials or live requests.
export const bookingSnapshot: RunSnapshotProps = {
  workflow: "appointment.book",
  externalId: "SYN-BOOK-RECENT",
  environment: "reference",
  release: "2026.10.17",
  startedAt: "24 Oct, 10:00 UTC",
  duration: "1.8 s",
  status: "Completed",
  metrics: [
    { label: "Accepted", value: "Yes", note: "Application-reported" },
    { label: "Integration", value: "Orbit", note: "Scheduling provider" },
    {
      label: "Confirmation",
      value: "Not recorded",
      note: "As of 11:00 UTC",
    },
    {
      label: "Expectation",
      value: "Overdue",
      note: "Declared deadline 10:20 UTC",
    },
  ],
  milestones: [
    {
      id: "request",
      label: "Booking requested",
      time: "+0 s",
      kind: "checkpoint",
      title: "Booking requested",
      description:
        "The application requested a booking from Orbit Scheduling with this synthetic reference.",
      payload: '{ "bookingRef": "SYN-BOOK-RECENT", "integration": "orbit" }',
      note: "Application-reported checkpoint",
    },
    {
      id: "accepted",
      label: "Booking accepted",
      time: "+1.8 s",
      kind: "completed",
      title: "Execution completed; acceptance reported",
      description:
        "Acceptance is reported by the application. A separate confirmation is expected; completion does not establish that confirmation arrived.",
      payload: '{ "bookingRef": "SYN-BOOK-RECENT", "accepted": true }',
      note: "Terminal result · 24 Oct, 10:00 UTC",
    },
  ],
  evidenceNote:
    "Synthetic Meridian Health evidence. Snapshot: 24 Oct, 11:00 UTC. No final confirmation is recorded.",
}
