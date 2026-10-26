import { Match } from "effect"
import type { WorkflowEvent } from "@flowmarkdev/core"

/** Last persisted terminal on a run. Failed wins over completed. */
export type RunTerminal = "open" | "completed" | "failed"

export const runTerminal = (types: ReadonlySet<string>): RunTerminal => {
  if (types.has("failed")) {
    return "failed"
  }
  if (types.has("completed")) {
    return "completed"
  }
  return "open"
}

/**
 * Events that must not append once a terminal is stored.
 * A later fail() may supersede completed. A second started is handled separately.
 */
export const ignoreContinuedEvent = (
  terminal: RunTerminal,
  eventType: WorkflowEvent["type"],
) =>
  Match.value(terminal).pipe(
    Match.when("open", () => false),
    Match.when("failed", () => true),
    Match.when("completed", () => eventType !== "failed"),
    Match.exhaustive,
  )
