/** Two fixed fictional cohorts, never fetched from an account. */
export const comparison = {
  eligible: 700,
  baselineConfirmed: 644,
  currentConfirmed: 532,
  completed: 695,
  coverage: 700,
  definition: "booking-confirmation / revision 3",
  baselineWindow: "10–17 Oct 2026",
  currentWindow: "17–24 Oct 2026",
  observedAt: "24 Oct 2026, 11:00 UTC",
} as const

export const journey = [
  {
    id: "referral",
    title: "Referral",
    code: "referral.ingest",
    status: "Received",
    time: "10:00:00",
    description:
      "The application accepted the referral and attached its reference to the process.",
    payload: 'referralRef: "SYN-REF-2049"',
    attention: false,
  },
  {
    id: "match",
    title: "Match",
    code: "patient.match",
    status: "Matched",
    time: "10:00:01",
    description:
      "A separate run reported a matching reference. The shared reference connects the observed work.",
    payload: "matched: true",
    attention: false,
  },
  {
    id: "booking",
    title: "Booking",
    code: "appointment.book",
    status: "Accepted",
    time: "10:00:02",
    description:
      "Orbit accepted the request. The booking run completed in 1.8 seconds; its confirmation is tracked separately.",
    payload: 'outcome: "submitted" · accepted: true',
    attention: false,
  },
  {
    id: "confirmation",
    title: "Confirmation",
    code: "booking.confirmed",
    status: "Not recorded",
    time: "Due 10:20",
    description:
      "The declared 20-minute deadline has passed. No confirmation is recorded at 11:00 UTC. The provider’s actual state remains unknown.",
    payload: 'expectation: "booking.confirmed"',
    attention: true,
  },
] as const
