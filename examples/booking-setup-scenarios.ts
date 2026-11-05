import type { ExpectationReference, FlowmarkClient } from "@flowmarkdev/node"

export interface BookingRequest {
  readonly bookingRef: string
  readonly confirmationId: string
}

export async function submitBookingWithClient(
  flowmark: FlowmarkClient,
  request: BookingRequest,
  submitToProvider: (bookingRef: string) => Promise<void>,
): Promise<ExpectationReference> {
  const flow = flowmark.workflow("booking.create", {
    properties: { bookingRef: request.bookingRef, synthetic: true },
  })
  const confirmation = flow.expect("provider-response", {
    id: request.confirmationId,
    within: "15m",
  })

  try {
    await flow.operation("submit-to-provider", () =>
      submitToProvider(request.bookingRef),
    )
    flow.done({ outcome: "submitted", result: { submitted: 1 } })
    return confirmation
  } catch (cause) {
    flow.fail({ code: "BOOKING_SUBMIT_FAILED", outcome: "unsubmitted" })
    throw cause
  }
}

/** Resolving an expectation does not reopen the run or replace its final result. */
export function recordProviderResponseWithClient(
  flowmark: FlowmarkClient,
  confirmation: ExpectationReference,
  reserved: number,
): void {
  flowmark.resolveExpectation(confirmation, {
    outcome: reserved > 0 ? "confirmed" : "no-availability",
    result: { reserved },
  })
}

export function withdrawBookingWithClient(
  flowmark: FlowmarkClient,
  confirmation: ExpectationReference,
): void {
  flowmark.cancelExpectation(confirmation, {
    code: "BOOKING_WITHDRAWN",
    message: "Guest withdrew the request before the provider responded",
  })
}
