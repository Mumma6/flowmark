import type { FlowmarkClient } from "@flowmarkdev/node"

const bookingRef = "B17"
const partnerDeliveries = [
  { envelopeId: "E11", changeId: "C41", receiptId: "R11" },
  { envelopeId: "E12", changeId: "C41", receiptId: "R12" },
  { envelopeId: "E13", changeId: "C42", receiptId: "R13" },
] as const

type DedupeKey = "envelopeId" | "bookingRef" | "changeId"

export function recordBookingRedeliveries(
  client: FlowmarkClient,
  dedupeKey: DedupeKey,
): void {
  const seen = new Set<string>()
  partnerDeliveries.forEach((delivery) => {
    const properties = { ...delivery, bookingRef, synthetic: true }
    const key = properties[dedupeKey]
    const flow = client.workflow("booking.reschedule", { properties })

    if (seen.has(key)) {
      flow.done({ outcome: "duplicate-suppressed" })
      return
    }

    seen.add(key)
    flow.done({ outcome: "confirmation-sent" })
  })
}
