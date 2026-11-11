"use client"

import { RunExpectations } from "../../../expectations/run-expectations"
import type { InvestigationSectionProps } from "../investigation-types"

export function ConfirmationsSection({
  source,
  expectationsPage,
  runId,
  contextual,
}: Pick<
  InvestigationSectionProps,
  "source" | "expectationsPage" | "runId" | "contextual"
>) {
  return (
    <RunExpectations
      page={expectationsPage}
      id={runId}
      source={source}
      replace={contextual}
    />
  )
}
