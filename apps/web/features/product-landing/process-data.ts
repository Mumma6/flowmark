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
    id: "request",
    title: "Booking request",
    code: "booking.request",
    status: "Received",
    time: "10:00:00",
    description:
      "The application received a booking request and recorded its reference.",
    payload: 'bookingRef: "BOOK-2049"',
    attention: false,
  },
  {
    id: "match",
    title: "Customer lookup",
    code: "customer.lookup",
    status: "Found",
    time: "10:00:01",
    description:
      "A separate run found the customer. The shared booking reference connects this lookup to the request.",
    payload: "customerFound: true",
    attention: false,
  },
  {
    id: "booking",
    title: "Booking",
    code: "booking.submit",
    status: "Accepted",
    time: "10:00:02",
    description:
      "The booking provider accepted the request. The booking run completed in 1.8 seconds; its confirmation is tracked separately.",
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
