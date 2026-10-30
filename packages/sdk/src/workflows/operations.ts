import { Effect, Ref } from "effect"
import type {
  WorkflowOperationFailure,
  WorkflowStepName,
} from "@flowmarkdev/core"
import type { WorkflowOperationOptions } from "../types/index.js"
import type { WorkflowEventData } from "./events.js"
import type { RunLifecycle } from "./run-lifecycle.js"
import type { WorkflowOperationHandle } from "./types.js"

/** Each handle owns its idempotency and duration; run state owns completion. */
export function makeOperations(run: RunLifecycle) {
  return Effect.fn("Flowmark.WorkflowOperations.start")(function* (
    operationName: WorkflowStepName,
    options?: WorkflowOperationOptions,
  ) {
    const operationId = yield* Effect.sync(() => globalThis.crypto.randomUUID())
    const startedAt = yield* Effect.sync(() => performance.now())
    const finished = yield* Ref.make(false)
    const canStart = yield* run.openOperation(operationId)
    if (canStart) {
      yield* run.record({
        type: "operation_started",
        operationId,
        operationName,
        ...(options?.properties === undefined
          ? {}
          : { properties: options.properties }),
      })
    }

    const finish = Effect.fn("Flowmark.WorkflowOperations.finish")(function* (
      terminal: (
        durationMs: number,
      ) => WorkflowEventData<"operation_completed" | "operation_failed">,
    ) {
      if (yield* Ref.getAndSet(finished, true)) {
        return
      }
      if ((yield* run.isFinished) || !canStart) {
        return
      }
      yield* run.closeOperation(operationId)
      const durationMs = yield* Effect.sync(() =>
        Math.max(0, performance.now() - startedAt),
      )
      yield* run.record(terminal(durationMs))
      yield* run.completeIfReady
    })
    return {
      operationId,
      done: finish((durationMs) => ({
        type: "operation_completed",
        operationId,
        operationName,
        durationMs,
      })),
      fail: (failure: WorkflowOperationFailure) =>
        finish((durationMs) => ({
          type: "operation_failed",
          operationId,
          operationName,
          durationMs,
          failure,
        })),
    } satisfies WorkflowOperationHandle
  })
}
