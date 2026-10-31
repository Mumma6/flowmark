import { expectationDuration } from "@flowmarkdev/core"
import type {
  ExpectationOptions,
  ExpectationReference,
} from "@flowmarkdev/core"
import { FlowmarkExpectationError } from "../errors/index.js"
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
export function makeMarkers(run: RunLifecycle, workflow: string) {
  const whenOpen = Effect.fn("Flowmark.WorkflowMarkers.record")(function* (
    createEvent: () => WorkflowEventData,
  ) {
    if (yield* run.isOpen) {
      yield* run.record(createEvent())
    }
  })
  return {
    expect: Effect.fn("Flowmark.expect")(function* (
      name: string,
      options: ExpectationOptions,
    ) {
      const reference: ExpectationReference = {
        version: 1,
        workflow,
        runId: run.runId,
        expectationId: options.id,
      }
      const event = {
        type: "expectation_declared" as const,
        name,
        expectationId: options.id,
        withinMs: expectationDuration(options.within) ?? 0,
      }
      if (!(yield* run.isOpen)) {
        yield* run.diagnose(
          new FlowmarkExpectationError({ reason: "run-closed" }),
          event,
        )
      } else {
        yield* run.record(event)
      }
      return reference
    }),
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
