import { Match } from "effect"

/** Existing historical mixed terminals retain their failed projection. New terminals never supersede. */
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
 * All new markers are ignored after a terminal; terminal conflicts are acknowledged separately.
 */
export const ignoreContinuedEvent = (terminal: RunTerminal) =>
  Match.value(terminal).pipe(
    Match.when("open", () => false),
    Match.when("failed", () => true),
    Match.when("completed", () => true),
    Match.exhaustive,
  )
