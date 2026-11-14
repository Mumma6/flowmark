import { Array, pipe } from "effect"

/** Fixed fictional observations, never fetched from an account. Each day has 100 eligible bookings. */
export const comparison = {
  baseline: [91, 92, 90, 94, 93, 92, 92],
  current: [90, 88, 82, 75, 69, 64, 64],
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

export const chartPoints = (values: readonly number[]) =>
  pipe(
    values,
    Array.map((value, index) => `${30 + index * 90},${180 - value * 1.5}`),
    Array.join(" "),
  )

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

export const processHealth = [
  {
    label: "Business outcomes",
    value: "Needs attention",
    detail: "76% confirmed within 20 minutes",
    color: "text-warning",
    dot: "bg-warning",
  },
  {
    label: "Execution behavior",
    value: "Stable",
    detail: "99.3% of runs completed",
    color: "text-success",
    dot: "bg-success",
  },
  {
    label: "Evidence quality",
    value: "Consistent",
    detail: "700 / 700 report the required fields",
    color: "text-highlight",
    dot: "bg-highlight",
  },
] as const
