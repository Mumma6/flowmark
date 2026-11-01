import {
  createFlowmark,
  FlowmarkDeliveryError,
  type DeliveryHealth,
} from "@flowmarkdev/node"

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
  const flow = flowmark.workflow("billing.reconcile", {
    properties: { period },
    release: `billing-worker+${period}`,
  })

  let summary: Reconciliation
  try {
    summary = await flow.operation("compare-ledger", () =>
      compareLedger(period),
    )
    flow.done({
      outcome: summary.mismatches === 0 ? "balanced" : "mismatched",
      result: {
        invoices: summary.invoices,
        mismatches: summary.mismatches,
      },
    })
  } catch (cause) {
    flow.fail({ code: "RECONCILE_FAILED" })
    throw cause
  }

  try {
    await flowmark.flush()
  } catch (cause) {
    if (cause instanceof FlowmarkDeliveryError) {
      console.error("[Flowmark] Drain failed", {
        failureCount: cause.failureCount,
        omittedFailureCount: cause.omittedFailureCount,
        retained: cause.failures.length,
      })
    }
    throw cause
  }
  return summary
}

export async function stopBillingWorker(): Promise<void> {
  const health: DeliveryHealth = flowmark.deliveryHealth()
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
