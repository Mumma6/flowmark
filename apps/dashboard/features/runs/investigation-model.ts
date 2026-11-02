import { Array, Option, pipe } from "effect"
import type { RunEvent } from "../../lib/api/types"
import { latestReportedProgress } from "../../lib/telemetry/run-presentation"
import { buildRunSnapshot } from "../../lib/telemetry/run-snapshot-presentation"
import { terminalEvidence } from "../../lib/telemetry/run-state"

export function buildInvestigation(events: readonly RunEvent[]) {
  return pipe(
    Array.head(events),
    Option.map((first) => {
      const context = new Map<string, unknown>()
      for (const event of events) {
        if (event.type === "started" || event.type === "properties") {
          for (const [key, value] of Object.entries(event.properties ?? {})) {
            context.set(key, value)
          }
        }
      }
      const { failure, completed, state } = terminalEvidence(events)
      const progress = latestReportedProgress(events)
      const reportedResult = failure?.result ?? completed?.result
      const lastReport = events.find(
        (event) => event.type === "report" && event.isLatestReport,
      )
      const snapshot = buildRunSnapshot(events)
      const errors = events.filter((event) => event.type === "error")
      const operations = events.filter(
        (event) => event.type === "operation_started",
      )
      return {
        first,
        context,
        failure,
        completed,
        state,
        progress,
        reportedResult,
        lastReport,
        snapshot,
        errors,
        operations,
      }
    }),
  )
}
