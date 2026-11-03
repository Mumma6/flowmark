import type { RouterOutputs } from "../platform/api-types"

export function issueEvidence(
  report?: RouterOutputs["project"]["periodReport"],
) {
  const increased =
    report?.workflows
      .map((item) => ({
        ...item,
        delta: item.current.failedRuns - item.previous.failedRuns,
      }))
      .filter((item) => item.delta > 0)
      .sort(
        (left, right) =>
          right.delta - left.delta || left.name.localeCompare(right.name),
      ) ?? []
  const slower =
    report?.operations
      .filter(
        (operation) =>
          operation.durationDeltaMs != null &&
          operation.durationDeltaMs > 0 &&
          operation.currentMedianDurationMs != null &&
          operation.previousMedianDurationMs != null,
      )
      .slice(0, 8) ?? []
  return { increased, slower }
}
