import type { ProviderAck } from "./provider.js"
import type { ConfirmationDecision } from "./decision.js"

/** Revision that confirms a payment only when the provider names the same change. */
export function decideLinked(
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
  if (ack.changeId === null || ack.changeId !== changeId) {
    return {
      status: "pending",
      outcome: ack.changeId === null ? "missing-link" : "other-change",
      changeId,
      providerChangeId: ack.changeId,
    }
  }
  return {
    status: "confirmed",
    outcome: "linked",
    changeId,
    providerChangeId: ack.changeId,
  }
}
