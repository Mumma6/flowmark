import type { WorkflowError, WorkflowFailure } from "@flowmarkdev/node"
import { flowmark } from "./flowmark"

declare function deliverBatch(campaignId: string): Promise<number>
declare function deliverFallback(campaignId: string): Promise<number>

/**
 * A rejected `operation()` records that operation as failed and rethrows
 * the original error. It does not fail the run. `error()` is another
 * non-terminal observation. Only `fail()` ends the run as failed.
 */
export async function sendCampaign(campaignId: string): Promise<number> {
  const flow = flowmark.workflow("notifications.campaign", {
    properties: { campaignId },
  })

  try {
    let delivered: number
    try {
      delivered = await flow.operation("deliver-batch", () =>
        deliverBatch(campaignId),
      )
    } catch {
      const observed: WorkflowError = {
        code: "PRIMARY_PROVIDER_REJECTED",
        message: "Primary provider rejected the batch",
        retryable: true,
        handled: true,
      }
      flow.error(observed)
      delivered = await flow.operation("deliver-fallback", () =>
        deliverFallback(campaignId),
      )
    }

    flow.done({ outcome: "sent", result: { delivered } })
    return delivered
  } catch (cause) {
    const failure: WorkflowFailure = {
      code: "CAMPAIGN_FAILED",
      message: "Neither provider accepted the campaign",
      retryable: false,
    }
    flow.fail({ ...failure, outcome: "unsent" })
    throw cause
  }
}
