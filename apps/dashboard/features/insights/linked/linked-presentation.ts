import type { LinkedCoverage, LinkedComparison } from "@flowmarkdev/core"
import { Match } from "effect"

export const linkedCoverageLabels: Readonly<Record<LinkedCoverage, string>> = {
  known: "Known recorded pairs",
  upstreamRevision: "Upstream revision missing or incompatible",
  ambiguousParent: "Ambiguous parent identity",
  missingLink: "No retained linked execution",
  multipleLinks: "Multiple linked attempts",
  releaseMismatch: "Different downstream release",
  downstreamRevision: "Downstream revision missing or incompatible",
  unfinished: "No downstream terminal evidence",
  missingResult: "Final result missing",
  missingMetric: "Selected count missing",
  invalidMetric: "Invalid count type or value",
}
export const linkedAvailabilityMessage = (
  comparison: LinkedComparison["comparison"],
) =>
  Match.value(comparison.reason).pipe(
    Match.when(
      "Empty",
      () =>
        "A selected window has no recorded upstream attempts. No difference can be established.",
    ),
    Match.when(
      "Incompatible",
      () =>
        "Revision mismatches prevent a comparable difference. The ratios below describe only known compatible pairs.",
    ),
    Match.when(
      "Thin",
      () =>
        "Each window needs at least five known pairs before showing a comparative difference.",
    ),
    Match.when(
      "ZeroDenominator",
      () =>
        "A selected denominator totals zero; a ratio and comparative difference are unavailable.",
    ),
    Match.when(
      null,
      () =>
        "The difference describes reported counts among known linked pairs. It does not establish a cause or complete conversion rate.",
    ),
    Match.exhaustive,
  )
export const linkedRatioLabel = (value: number | null) =>
  value === null ? "Unavailable" : `${(value * 100).toFixed(2)}%`
