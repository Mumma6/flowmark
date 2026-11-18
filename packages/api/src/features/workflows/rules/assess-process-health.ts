import {
  PROCESS_HEALTH_LIMITS,
  type ProcessHealth,
  type ProcessHealthComparison,
  type ProcessHealthWindow,
} from "@flowmarkdev/core"

export function compareProcessHealth(
  current: ProcessHealthWindow,
  baseline: ProcessHealthWindow | null,
): ProcessHealthComparison {
  if (!baseline) {
    return { status: "no-baseline" }
  }

  const currentMature = current.expectations.mature
  const baselineMature = baseline.expectations.mature
  if (currentMature === 0 || baselineMature === 0) {
    return { status: "zero-denominator" }
  }

  const currentRevisions = current.evidenceQuality.revisions
  const baselineRevisions = baseline.evidenceQuality.revisions
  if (
    currentRevisions.length !== 1 ||
    baselineRevisions.length !== 1 ||
    currentRevisions[0] !== baselineRevisions[0]
  ) {
    return { status: "incompatible-revisions" }
  }

  if (
    Math.min(currentMature, baselineMature) <
    PROCESS_HEALTH_LIMITS.minimumMatureDeclarations
  ) {
    return { status: "thin-history" }
  }

  return {
    status: "comparable",
    overdueRateDelta:
      current.expectations.overdue / currentMature -
      baseline.expectations.overdue / baselineMature,
  }
}

export function processHealthAttention(
  current: ProcessHealthWindow,
): Extract<ProcessHealth, { status: "assessed" }>["attention"] {
  if (current.expectations.mature === 0) {
    return "zero-denominator"
  }
  return current.expectations.overdue > 0 ? "overdue" : "quiet"
}
