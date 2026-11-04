// Fictional application code. submitBooking owns the work and persists/forwards
// the expectation reference in its existing request metadata.
export const bookingCode = `async function bookAppointment(referralRef: string) {
  const run = flowmark.workflow("appointment.book", {
    correlationId: referralRef,
    properties: { customer: "Cedar Health", integration: "orbit" },
  })

  try {
    const confirmation = run.expect("booking.confirmed", {
      within: "20m",
    })
    const booking = await submitBooking({
      referralRef,
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
