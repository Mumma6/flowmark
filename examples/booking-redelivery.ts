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

const text = (value: unknown) => (typeof value === "string" ? value : undefined)

export function summarizeBookingRedeliveries(
  events: readonly {
    readonly changeId?: unknown
    readonly outcome?: unknown
    readonly synthetic?: unknown
  }[],
) {
  const changeIds = events.reduce<string[]>((ids, event) => {
    const changeId = text(event.changeId)
    return changeId !== undefined && !ids.includes(changeId)
      ? [...ids, changeId]
      : ids
  }, [])
  return {
    synthetic: events.every((event) => event.synthetic === true),
    suppressions: events.filter(
      (event) => text(event.outcome) === "duplicate-suppressed",
    ).length,
    intents: changeIds.length,
    acceptances: events.filter(
      (event) => text(event.outcome) === "confirmation-sent",
    ).length,
    recipientDelivery: "unknown" as const,
  }
}
