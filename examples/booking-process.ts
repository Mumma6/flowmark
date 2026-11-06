import type { ExpectationReference } from "@flowmarkdev/node"
import { flowmark } from "./flowmark"
import {
  recordProviderResponseWithClient,
  submitBookingWithClient,
  withdrawBookingWithClient,
  type BookingRequest,
} from "./booking-setup-scenarios"

declare function submitToProvider(bookingRef: string): Promise<void>

/**
 * `expect` declares evidence the server should observe. It does not wait,
 * book the room, or verify the provider response.
 */
export async function submitBooking(
  request: BookingRequest,
): Promise<ExpectationReference> {
  return submitBookingWithClient(flowmark, request, submitToProvider)
}

/** Resolving an expectation does not reopen the run or replace its final result. */
export function recordProviderResponse(
  confirmation: ExpectationReference,
  reserved: number,
): void {
  recordProviderResponseWithClient(flowmark, confirmation, reserved)
}

export function withdrawBooking(confirmation: ExpectationReference): void {
  withdrawBookingWithClient(flowmark, confirmation)
}

export type { BookingRequest } from "./booking-setup-scenarios"
