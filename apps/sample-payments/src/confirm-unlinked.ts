import type { ProviderAck } from "./provider.js"
import type { ConfirmationDecision } from "./decision.js"

/**
 * Revision that records a provider receipt without the logical change.
 * A matching acknowledgement and a foreign acknowledgement both confirm the
 * original payment. The application's happy path still passes.
 */
export function decideUnlinked(
  changeId: string,
  ack: ProviderAck,
): ConfirmationDecision {
  if (ack.kind === "timeout") {
    return {
      status: "pending",
      outcome: "timeout",
      changeId,
      providerChangeId: null,
    }
  }
  return {
    status: "confirmed",
    outcome: "unlinked-receipt",
    changeId,
    providerChangeId: ack.changeId,
  }
}
