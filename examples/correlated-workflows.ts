import type { WorkflowCorrelationId } from "@flowmarkdev/node"
import { flowmark } from "./flowmark"

interface OrderWork {
  readonly orderId: string
  readonly correlationId: WorkflowCorrelationId
}

interface PackedOrder {
  readonly parcels: number
}

interface ShippingLabel {
  readonly trackingNumber: string
}

declare function packItems(orderId: string): Promise<PackedOrder>
declare function buyLabel(orderId: string): Promise<ShippingLabel>

/**
 * Related runs stay independent. Pass `correlationId` and `parentRunId`
 * yourself; neither value is copied onto later workflows automatically.
 */
export async function fulfillOrder(work: OrderWork): Promise<ShippingLabel> {
  const order = flowmark.workflow("orders.fulfill", {
    properties: { orderId: work.orderId },
    correlationId: work.correlationId,
  })

  let packed: PackedOrder
  try {
    packed = await order.operation("pack-items", () => packItems(work.orderId))
  } catch (cause) {
    order.fail({ code: "PACK_FAILED" })
    throw cause
  }

  const shipment = flowmark.workflow("shipping.label", {
    properties: { orderId: work.orderId, parcels: packed.parcels },
    correlationId: work.correlationId,
    parentRunId: order.runId,
  })

  try {
    const label = await shipment.operation("buy-label", () =>
      buyLabel(work.orderId),
    )
    shipment.done({
      outcome: "labeled",
      result: { trackingNumber: label.trackingNumber },
    })
    order.done({
      outcome: "fulfilled",
      result: {
        parcels: packed.parcels,
        trackingNumber: label.trackingNumber,
      },
    })
    return label
  } catch (cause) {
    shipment.fail({ code: "LABEL_PURCHASE_FAILED" })
    order.fail({
      code: "FULFILLMENT_INCOMPLETE",
      outcome: "packed",
      result: { parcels: packed.parcels },
    })
    throw cause
  }
}
