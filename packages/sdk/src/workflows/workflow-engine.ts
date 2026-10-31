import { Context, Effect, Layer } from "effect"
import type { WorkflowName } from "@flowmarkdev/core"
import type { WorkflowRunOptions } from "../types/index.js"
import { makeMarkers } from "./markers.js"
import { makeOperations } from "./operations.js"
import { WorkflowRuns } from "./run-lifecycle.js"
import type { WorkflowHandle } from "./types.js"

export interface WorkflowEngineService {
  readonly start: (
    name: WorkflowName,
    options: WorkflowRunOptions,
  ) => Effect.Effect<WorkflowHandle>
}

/** Coordinates run creation and the public handle's internal capabilities. */
export class WorkflowEngine extends Context.Service<
  WorkflowEngine,
  WorkflowEngineService
>()("@flowmarkdev/node/WorkflowEngine") {
  static readonly layer = Layer.effect(
    WorkflowEngine,
    Effect.gen(function* () {
      const runs = yield* WorkflowRuns
      const start = Effect.fn("Flowmark.WorkflowEngine.start")(function* (
        workflow: WorkflowName,
        options: WorkflowRunOptions,
      ) {
        const run = yield* runs.start(workflow, options)
        return {
          runId: run.runId,
          ...makeMarkers(run, workflow),
          operation: makeOperations(run),
          done: run.done,
          fail: run.fail,
        } satisfies WorkflowHandle
      })
      return WorkflowEngine.of({ start })
    }),
  )
}
