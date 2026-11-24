import { Array } from "effect"

export const receiptCohortClasses = [
  "reported-current",
  "historical",
  "mixed-receipts",
  "unknown",
] as const

export type ReceiptCohortClass = (typeof receiptCohortClasses)[number]

/** A receipt is a reported callback, not the time that code served. */
export const receiptCohortStatement =
  "A deployment receipt is a reported callback. It is not an interval during which that code served."

export type ReceiptCohort = {
  readonly receiptClass: ReceiptCohortClass
  readonly receiptIds: readonly string[]
  readonly statement: typeof receiptCohortStatement
  readonly classMayBeIncomplete: boolean
  readonly rateWithheld: boolean
}

/** Classify one comparison window from the receipts it actually contains. */
export function classifyReceiptCohort(input: {
  readonly deploymentIds: readonly string[]
  readonly latestDeploymentIds: readonly string[]
  readonly scanTruncated: boolean
}): ReceiptCohort {
  const receiptIds = Array.dedupe(input.deploymentIds)
  const classMayBeIncomplete = input.scanTruncated
  const current =
    receiptIds.length === 1 &&
    input.latestDeploymentIds.includes(receiptIds[0] ?? "")
  const receiptClass: ReceiptCohortClass = classMayBeIncomplete
    ? "unknown"
    : receiptIds.length > 1
      ? "mixed-receipts"
      : current
        ? "reported-current"
        : "historical"
  return {
    receiptClass,
    receiptIds,
    statement: receiptCohortStatement,
    classMayBeIncomplete,
    rateWithheld:
      classMayBeIncomplete ||
      receiptClass === "mixed-receipts" ||
      receiptClass === "unknown",
  }
}
