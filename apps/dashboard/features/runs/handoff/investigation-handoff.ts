import { Array, Option } from "effect"
import type { RunEvent } from "../../platform/api-types"
import { terminalEvidence } from "../models/run-state"

/** Facts for a handoff, with missing telemetry kept distinct from a failure. */
export function investigationHandoff(
  events: readonly RunEvent[],
  runPath: string,
) {
  return Array.head(events).pipe(
    Option.map((first) => {
      const { state, failure, completed } = terminalEvidence(events)
      const terminal = failure ?? completed
      return [
        `Flowmark investigation: ${first.workflow}`,
        `Run: ${first.externalId}`,
        `Execution status: ${state === "Running" ? "No final outcome recorded" : state}`,
        `Started (application timestamp): ${first.timestamp}`,
        `Environment: ${first.environment ?? "Not recorded"}`,
        `Release: ${first.release ?? "Not recorded"}`,
        `Correlation ID: ${first.correlationId ?? "Not recorded"}`,
        `Parent run ID: ${first.parentRunId ?? "Not recorded"}`,
        `Failure code: ${failure?.error?.code ?? "Not recorded"}`,
        `Failure message: ${failure?.error?.message ?? failure?.reason ?? "Not recorded"}`,
        `Reported outcome: ${terminal?.outcome ?? "Not recorded"}`,
        `Recorded events: ${events.length}`,
        `Evidence: ${runPath}`,
        "Application-reported evidence. Business correctness and root cause are not verified by Flowmark.",
      ].join("\n")
    }),
  )
}
