import { flowmark } from "./flowmark"

interface Reservation {
  readonly reservationId: string
}

interface PaymentCapture {
  readonly paymentId: string
}

declare function reserveInventory(orderId: string): Promise<Reservation>
declare function capturePayment(orderId: string): Promise<PaymentCapture>

/**
 * Overlapping operations keep separate ids and durations. `done()` waits
 * while handles are still open; `fail()` can end the run immediately.
 */
export async function prepareFulfillment(orderId: string): Promise<{
  readonly inventory: Reservation
  readonly payment: PaymentCapture
}> {
  return flowmark.workflow(
    "fulfillment.prepare",
    async (flow) => {
      const [inventory, payment] = await Promise.all([
        flow.operation("reserve-inventory", () => reserveInventory(orderId)),
        flow.operation("capture-payment", () => capturePayment(orderId)),
      ])
      flow.done({
        outcome: "ready",
        result: {
          reservationId: inventory.reservationId,
          paymentId: payment.paymentId,
        },
      })
      return { inventory, payment }
    },
    { properties: { orderId } },
  )
}
