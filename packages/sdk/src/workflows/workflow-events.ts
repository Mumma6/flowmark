import { Clock, Context, Effect, Layer } from "effect"
import type { WorkflowName } from "@flowmarkdev/core"
import { DeliveryQueue } from "../delivery/delivery-queue.js"
import type { WorkflowEventData } from "./events.js"

export interface RunEventRecorder {
  readonly record: (event: WorkflowEventData) => Effect.Effect<void>
}

export interface WorkflowEventsService {
  readonly forRun: (
    workflow: WorkflowName,
    runId: string,
  ) => Effect.Effect<RunEventRecorder>
}

/** Client-owned service; each recorder has its own delivery ordering semaphore. */
export class WorkflowEvents extends Context.Tag(
  "@flowmarkdev/node/WorkflowEvents",
)<WorkflowEvents, WorkflowEventsService>() {
  static readonly layer = Layer.effect(
    WorkflowEvents,
    Effect.gen(function* () {
      const delivery = yield* DeliveryQueue
      const forRun = Effect.fn("Flowmark.WorkflowEvents.forRun")(function* (
        workflow: WorkflowName,
        runId: string,
      ) {
        const ordering = yield* Effect.makeSemaphore(1)
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
        return { record } satisfies RunEventRecorder
      })
      return WorkflowEvents.of({ forRun })
    }),
  )
}
