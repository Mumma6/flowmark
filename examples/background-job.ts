import { createFlowmark } from "@flowmarkdev/node"

interface Reconciliation {
  readonly invoices: number
  readonly mismatches: number
}

declare function compareLedger(period: string): Promise<Reconciliation>

/**
 * A one-shot worker owns its client. `flush()` drains without closing it.
 * `shutdown()` drains and then refuses new runs. Either call rejects when
 * delivery failed.
 */
const flowmark = createFlowmark({
  environment: "production",
  release: "billing-worker",
})

export async function reconcileInvoices(
  period: string,
): Promise<Reconciliation> {
  try {
    return await flowmark.workflow(
      "billing.reconcile",
      async (flow) => {
        const summary = await flow.operation("compare-ledger", () =>
          compareLedger(period),
        )
        flow.done({
          outcome: summary.mismatches === 0 ? "balanced" : "mismatched",
          result: {
            invoices: summary.invoices,
            mismatches: summary.mismatches,
          },
        })
        return summary
      },
      { properties: { period } },
    )
  } finally {
    try {
      await flowmark.flush()
    } catch (error) {
      console.error("Flowmark delivery failed", error)
    }
  }
}

export async function stopBillingWorker(): Promise<void> {
  const health = flowmark.deliveryHealth()
  if (health.failed > 0 || health.dropped > 0) {
    console.error("[Flowmark] Delivery degraded before shutdown", {
      failed: health.failed,
      dropped: health.dropped,
      pending: health.pending,
      lastFailure: health.lastFailure?.type,
    })
  }
  await flowmark.shutdown()
}
