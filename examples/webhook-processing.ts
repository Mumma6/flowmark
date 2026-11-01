import type { WorkflowRunId } from "@flowmarkdev/node"
import { flowmark } from "./flowmark"

interface PaymentWebhook {
  readonly runId: WorkflowRunId
  readonly paymentId: string
  readonly status: "paid" | "failed"
}

/**
 * The webhook handler continues the checkout run started earlier.
 * Same workflow name and `id` append to that run. A repeated start does
 * not rewrite the original context; `setProperties` amends it while open.
 */
export function handlePaymentWebhook(event: PaymentWebhook): void {
  const flow = flowmark.workflow("checkout.payment", { id: event.runId })
  flow.setProperties({ paymentId: event.paymentId })

  if (event.status === "failed") {
    flow.fail({
      code: "PAYMENT_DECLINED",
      outcome: "unpaid",
      result: { paid: false },
    })
    return
  }

  flow.step("payment-confirmed", {
    properties: { paymentId: event.paymentId },
  })
  flow.done({
    outcome: "paid",
    result: { paid: true, paymentId: event.paymentId },
  })
}
