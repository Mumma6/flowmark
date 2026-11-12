"use client"

import { RunHandoff } from "../../handoff/run-handoff"
import type { InvestigationSectionProps } from "../investigation-types"

export function HandoffSection({
  runId,
  events,
  contextual,
}: Pick<InvestigationSectionProps, "runId" | "events" | "contextual">) {
  return <RunHandoff runId={runId} events={events} contextual={contextual} />
}
