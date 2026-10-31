import { Clock, Context, Effect, Layer, Semaphore } from "effect"
import type { DeliveryFailure } from "../errors/index.js"
import type { WorkflowName } from "@flowmarkdev/core"
import { DeliveryQueue } from "../delivery/delivery-queue.js"
import type { WorkflowEventData } from "./events.js"

export interface RunEventRecorder {
  readonly diagnose: (
    error: DeliveryFailure,
    event: WorkflowEventData,
  ) => Effect.Effect<void>
  readonly record: (event: WorkflowEventData) => Effect.Effect<void>
}

export interface WorkflowEventsService {
  readonly forRun: (
    workflow: WorkflowName,
    runId: string,
  ) => Effect.Effect<RunEventRecorder>
}

/** Client-owned service; each recorder has its own delivery ordering semaphore. */
export class WorkflowEvents extends Context.Service<
  WorkflowEvents,
  WorkflowEventsService
>()("@flowmarkdev/node/WorkflowEvents") {
  static readonly layer = Layer.effect(
    WorkflowEvents,
    Effect.gen(function* () {
      const delivery = yield* DeliveryQueue
      const recorders = new Map<string, RunEventRecorder>()
      const forRun = Effect.fn("Flowmark.WorkflowEvents.forRun")(function* (
        workflow: WorkflowName,
        runId: string,
      ) {
        const key = JSON.stringify([workflow, runId])
        const cached = recorders.get(key)
        if (cached) {
          return cached
        }
        const ordering = yield* Semaphore.make(1)
        const record = Effect.fn("Flowmark.WorkflowEvents.record")(function* (
          event: WorkflowEventData,
        ) {
          const now = yield* Clock.currentTimeMillis
          yield* delivery.enqueue(
            {
              workflow,
              runId,
              timestamp: new Date(now).toISOString(),
              ...event,
            },
            ordering,
          )
        })
        const recorder = {
          record,
          diagnose: (error: DeliveryFailure, event: WorkflowEventData) =>
            Effect.gen(function* () {
              const now = yield* Clock.currentTimeMillis
              yield* delivery.diagnose(error, {
                workflow,
                runId,
                timestamp: new Date(now).toISOString(),
                ...event,
              })
            }),
        } satisfies RunEventRecorder
        // Bounded routing cache; local handle state remains isolated. No durable delivery claim.
        if (recorders.size >= 1000) {
          recorders.delete(recorders.keys().next().value!)
        }
        recorders.set(key, recorder)
        return recorder
      })
      return WorkflowEvents.of({ forRun })
    }),
  )
}
