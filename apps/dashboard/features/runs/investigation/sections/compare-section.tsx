"use client"

import { RunComparisonPanel } from "../panels/run-comparison-panel"
import type { InvestigationSectionProps } from "../investigation-types"

export function CompareSection({
  source,
  comparison,
  comparisonLoading,
  comparisonError,
  contextual,
}: Pick<
  InvestigationSectionProps,
  | "source"
  | "comparison"
  | "comparisonLoading"
  | "comparisonError"
  | "contextual"
>) {
  return (
    <>
      <RunComparisonPanel
        source={source}
        replace={contextual}
        comparison={comparison}
        loading={comparisonLoading}
        error={comparisonError}
      />
    </>
  )
}
