// Fictional application code. submitBooking owns the work and persists/forwards
// the expectation reference in its existing request metadata.
export const bookingCode = `async function submitBookingRequest(bookingRef: string) {
  const run = flowmark.workflow("booking.submit", {
    correlationId: bookingRef,
    properties: { integration: "booking-provider" },
  })

  try {
    const confirmation = run.expect("booking.confirmed", {
      within: "20m",
    })
    const booking = await submitBooking({
      bookingRef,
      confirmation,
    })
    run.done({
      outcome: "submitted",
      result: { accepted: booking.accepted },
    })
    return booking
  } catch (error) {
    run.fail({ code: "BOOKING_FAILED" })
    throw error
  }
}`
