import { flowmark } from "./flowmark"

interface Shipment {
  readonly id: string
}

declare function createShipment(orderId: string): Promise<Shipment>

/** Record an order the application is already completing. */
export async function completeCheckout(orderId: string): Promise<Shipment> {
  return flowmark.workflow(
    "checkout.order",
    async (flow) => {
      flow.step("payment-captured", { properties: { orderId } })
      const shipment = await flow.operation("create-shipment", () =>
        createShipment(orderId),
      )
      flow.done({
        outcome: "complete",
        result: { shipmentId: shipment.id },
      })
      return shipment
    },
    { properties: { orderId } },
  )
}
