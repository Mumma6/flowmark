import type { JsonValue, WorkflowProperties } from "@flowmarkdev/node"
import { flowmark } from "./flowmark"

interface Shipment {
  readonly id: string
}

declare function createShipment(orderId: string): Promise<Shipment>

/** Record an order the application is already completing. */
export async function completeCheckout(orderId: string): Promise<Shipment> {
  const source: JsonValue = "checkout"
  const properties: WorkflowProperties = { orderId, source }
  const flow = flowmark.workflow("checkout.order", { properties })

  try {
    flow.step("payment-captured", { properties: { orderId } })
    const shipment = await flow.operation("create-shipment", () =>
      createShipment(orderId),
    )
    flow.done({
      outcome: "complete",
      result: { shipmentId: shipment.id },
    })
    return shipment
  } catch (cause) {
    flow.fail({ code: "CHECKOUT_FAILED" })
    throw cause
  }
}
