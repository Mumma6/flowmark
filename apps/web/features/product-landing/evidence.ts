import type { RunSnapshotProps } from "@flowmark/ui"

export interface EvidenceStep {
  readonly name: string
  readonly label: string
  readonly detail: string
  readonly state: "recorded" | "attention"
  readonly payload: string
}

export interface InvestigationExample {
  readonly id: string
  readonly title: string
  readonly reference: string
  readonly customer: string
  readonly integration: string
  readonly headline: string
  readonly explanation: string
  readonly result: string
  readonly question: string
  readonly agentAnswer: string
  readonly steps: readonly EvidenceStep[]
  readonly snapshot: RunSnapshotProps
}

// Fictional, fixed evidence. No health records, credentials or live requests.
export const investigations: readonly InvestigationExample[] = [
  {
    id: "booking",
    title: "Appointment booking",
    reference: "SYN-BOOK-RECENT",
    customer: "Cedar Health",
    integration: "Orbit Scheduling",
    headline: "The booking completed. The confirmation isn’t recorded.",
    explanation:
      "Orbit accepted the booking. Its separate confirmation is not recorded by the declared deadline. Follow the reference across the process to see exactly what was reported.",
    result: "Confirmation overdue",
    question: "What happened to Cedar Health’s booking?",
    agentAnswer:
      "The booking run completed in 1.8 s and reported accepted: true. Its confirmation expectation is overdue at this snapshot. There is no recorded confirmation; that alone does not establish an Orbit failure.",
    steps: [
      {
        name: "referral.ingest",
        label: "Referral received",
        detail: "Accepted · 10:00:00",
        state: "recorded",
        payload: '{ "referralRef": "SYN-REF-2049", "accepted": true }',
      },
      {
        name: "patient.match",
        label: "Reference matched",
        detail: "Matched · 10:00:01",
        state: "recorded",
        payload: '{ "referralRef": "SYN-REF-2049", "matched": true }',
      },
      {
        name: "appointment.book",
        label: "Booking accepted",
        detail: "Completed · 1.8 s",
        state: "recorded",
        payload: '{ "bookingRef": "SYN-BOOK-RECENT", "accepted": true }',
      },
      {
        name: "booking.confirmed",
        label: "Confirmation",
        detail: "Expected by 10:20",
        state: "attention",
        payload:
          '{ "expectation": "booking.confirmed", "deadline": "10:20 UTC", "observed": false, "asOf": "11:00 UTC" }',
      },
    ],
    snapshot: {
      workflow: "appointment.book",
      externalId: "SYN-BOOK-RECENT",
      environment: "reference",
      release: "2026.10.24",
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
          payload:
            '{ "bookingRef": "SYN-BOOK-RECENT", "integration": "orbit" }',
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
    },
  },
  {
    id: "referral",
    title: "Referral import",
    reference: "SYN-IMPORT-2049",
    customer: "Cedar Health",
    integration: "Referral API",
    headline: "A completed import. A more useful answer than “success.”",
    explanation:
      "The application processed 1,000 referrals: 942 accepted, 38 rejected and 20 sent for review. Execution completion and reported business results stay separate.",
    result: "58 need attention",
    question: "Did the referral import deliver its intended outcome?",
    agentAnswer:
      "The run completed and reported 942 accepted, 38 rejected and 20 for review out of 1,000 received. That is a 94.2% reported acceptance rate for this batch. These counts are application-reported, not independently verified.",
    steps: [
      {
        name: "referral.received",
        label: "Receive batch",
        detail: "1,000 referrals",
        state: "recorded",
        payload: '{ "received": 1000 }',
      },
      {
        name: "referral.validate",
        label: "Validate records",
        detail: "38 rejected",
        state: "attention",
        payload: '{ "rejected": 38, "reason": "INCOMPLETE_REFERENCE" }',
      },
      {
        name: "referral.review",
        label: "Route for review",
        detail: "20 for review",
        state: "attention",
        payload: '{ "review": 20 }',
      },
      {
        name: "referral.ingest",
        label: "Report outcome",
        detail: "942 accepted",
        state: "recorded",
        payload:
          '{ "received": 1000, "accepted": 942, "rejected": 38, "review": 20 }',
      },
    ],
    snapshot: {
      workflow: "referral.ingest",
      externalId: "SYN-IMPORT-2049",
      environment: "reference",
      release: "2026.10.24",
      startedAt: "24 Oct, 09:42 UTC",
      duration: "8.4 s",
      status: "Completed",
      metrics: [
        { label: "Received", value: "1,000", note: "Application-reported" },
        { label: "Accepted", value: "942", note: "Application-reported" },
        { label: "Rejected", value: "38", note: "Incomplete reference" },
        { label: "For review", value: "20", note: "Application-reported" },
      ],
      milestones: [
        {
          id: "received",
          label: "Batch received",
          time: "+0 s",
          kind: "checkpoint",
          title: "1,000 referrals received",
          description:
            "A fixed synthetic batch was received from the Referral API.",
          payload: '{ "received": 1000 }',
          note: "Application-reported checkpoint",
        },
        {
          id: "completed",
          label: "Result reported",
          time: "+8.4 s",
          kind: "completed",
          title: "Completed with a mixed business result",
          description:
            "The run completed while reporting rejected and review counts. Technical completion does not erase that business context.",
          payload:
            '{ "received": 1000, "accepted": 942, "rejected": 38, "review": 20 }',
          note: "Application-reported result",
        },
      ],
      evidenceNote:
        "Synthetic Meridian Health evidence. This single batch is not a whole customer journey or a complete conversion funnel.",
    },
  },
]
