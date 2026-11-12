import type { FlowmarkClient } from "@flowmarkdev/node"
import definition from "./booking-definition.json"

/** Import the JSON explicitly in Studio first. Starting this run uploads only telemetry. */
export async function submitCodeOwnedBooking(
  flowmark: FlowmarkClient,
  bookingRef: string,
  submitToProvider: (reference: string) => Promise<void>,
): Promise<void> {
  const flow = flowmark.workflow(definition.workflow, {
    properties: { bookingRef, definitionRevision: definition.result.revision },
  })
  try {
    await flow.operation("submit", () => submitToProvider(bookingRef))
    flow.done({ outcome: "submitted", result: { submitted: 1 } })
  } catch (error) {
    flow.fail({ code: "BOOKING_SUBMIT_FAILED", outcome: "unsubmitted" })
    throw error
  }
}
