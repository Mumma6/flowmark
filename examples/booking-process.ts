import type {
  ExpectationCancellation,
  ExpectationOptions,
  ExpectationReference,
  ExpectationResolution,
} from "@flowmarkdev/node"
import { flowmark } from "./flowmark"

interface BookingRequest {
  readonly bookingRef: string
  readonly confirmationId: string
}

declare function submitToProvider(bookingRef: string): Promise<void>

/**
 * `expect` declares evidence the server should observe. It does not wait,
 * book the room, or verify the provider response.
 */
export async function submitBooking(
  request: BookingRequest,
): Promise<ExpectationReference> {
  const flow = flowmark.workflow("booking.create", {
    properties: { bookingRef: request.bookingRef },
  })
  const expectation: ExpectationOptions = {
    id: request.confirmationId,
    within: "15m",
  }
  const confirmation = flow.expect("provider-response", expectation)

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
export function recordProviderResponse(
  confirmation: ExpectationReference,
  reserved: number,
): void {
  const resolution: ExpectationResolution = {
    outcome: reserved > 0 ? "confirmed" : "no-availability",
    result: { reserved },
  }
  flowmark.resolveExpectation(confirmation, resolution)
}

export function withdrawBooking(confirmation: ExpectationReference): void {
  const cancellation: ExpectationCancellation = {
    code: "BOOKING_WITHDRAWN",
    message: "Guest withdrew the request before the provider responded",
  }
  flowmark.cancelExpectation(confirmation, cancellation)
}
