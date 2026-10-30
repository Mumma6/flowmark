import { Effect } from "effect"
import type {
  WorkflowError,
  WorkflowProgress,
  WorkflowProperties,
  WorkflowResult,
  WorkflowStepName,
} from "@flowmarkdev/core"
import type { WorkflowStepOptions } from "../types/index.js"
import type { WorkflowEventData } from "./events.js"
import type { RunLifecycle } from "./types.js"

/** Markers observe application-reported evidence; they keep no aggregate state. */
export function makeMarkers(run: RunLifecycle) {
  const whenOpen = Effect.fn("Flowmark.WorkflowMarkers.record")(function* (
    createEvent: () => WorkflowEventData,
  ) {
    if (yield* run.isOpen) {
      yield* run.record(createEvent())
    }
  })
  return {
    step: (step: WorkflowStepName, options?: WorkflowStepOptions) =>
      whenOpen(() => ({
        type: "step",
        step,
        ...(options?.properties === undefined
          ? {}
          : { properties: options.properties }),
      })),
    error: (error: WorkflowError) => whenOpen(() => ({ type: "error", error })),
    progress: (progress: WorkflowProgress) =>
      whenOpen(() => ({ type: "progress", ...progress })),
    report: (result: WorkflowResult) =>
      whenOpen(() => ({ type: "report", result })),
    setProperties: Effect.fn("Flowmark.WorkflowMarkers.setProperties")(
      function* (properties: WorkflowProperties) {
        // Preserve the shared client's existing pending-completion behavior.
        // Aligning this guard with other markers requires a separate behavior change.
        if (!(yield* run.isFinished)) {
          yield* run.record({ type: "properties", properties })
        }
      },
    ),
  }
}
