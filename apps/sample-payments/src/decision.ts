export type ConfirmationOutcome =
  | "pending"
  | "linked"
  | "unlinked-receipt"
  | "other-change"
  | "missing-link"
  | "timeout"
  | "rolled-back"

export type ConfirmationDecision = {
  readonly status: "pending" | "confirmed"
  readonly outcome: ConfirmationOutcome
  readonly changeId: string
  readonly providerChangeId: string | null
}

export type PaymentResult = ConfirmationDecision & {
  readonly id: string
  readonly amountCents: number
  readonly attempts: number
}

/** Two results are the same change only when both confirm that exact provider change. */
export function recordsSameChange(
  left: ConfirmationDecision,
  right: ConfirmationDecision,
): boolean {
  return (
    left.status === "confirmed" &&
    right.status === "confirmed" &&
    left.providerChangeId !== null &&
    left.providerChangeId === left.changeId &&
    right.providerChangeId === right.changeId
  )
}
