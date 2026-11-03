import { mergedRunContext } from "./run-context"
import { Array, Option, pipe } from "effect"
import type { RunEvent } from "../platform/api-types"
import { latestReportedProgress } from "./run-presentation"
import { buildRunSnapshot } from "./run-snapshot-presentation"
import { terminalEvidence } from "./run-state"

export function buildInvestigation(events: readonly RunEvent[]) {
  return pipe(
    Array.head(events),
    Option.map((first) => {
      const context = mergedRunContext(events)
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
