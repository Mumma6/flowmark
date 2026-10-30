import { Context, Effect, FiberSet, Layer, Ref, Semaphore } from "effect"
import { decodeWorkflowEvent, type WorkflowEvent } from "@flowmarkdev/core"
import {
  FlowmarkDeliveryError,
  FlowmarkQueueError,
  WorkflowTransportError,
  type DeliveryFailure,
} from "../errors/index.js"
import type { InstrumentationErrorHandler } from "../types/index.js"
import { WorkflowTransport } from "./ports/workflow-transport.js"

export interface DeliveryQueueService {
  readonly enqueue: (
    event: WorkflowEvent,
    ordering: Semaphore.Semaphore,
  ) => Effect.Effect<void>
  readonly flush: Effect.Effect<void, FlowmarkDeliveryError>
  readonly shutdown: Effect.Effect<void, FlowmarkDeliveryError>
}
export class DeliveryQueue extends Context.Service<
  DeliveryQueue,
  DeliveryQueueService
>()("@flowmarkdev/node/DeliveryQueue") {
  static layer(onError?: InstrumentationErrorHandler) {
    return Layer.effect(
      DeliveryQueue,
      Effect.gen(function* () {
        const transport = yield* WorkflowTransport
        const pending = yield* FiberSet.make<void, never>()
        const failures = yield* Ref.make<ReadonlyArray<DeliveryFailure>>([])
        const closed = yield* Ref.make(false)
        const queueAccess = yield* Semaphore.make(1)

        const report = Effect.fn("Flowmark.DeliveryQueue.report")(function* (
          error: DeliveryFailure,
          event: WorkflowEvent,
        ) {
          yield* Ref.update(failures, (errors) => [...errors, error])
          if (onError) {
            yield* Effect.sync(() => onError(error, event)).pipe(
              Effect.catchCause(() =>
                Effect.logWarning(
                  "[Flowmark] Instrumentation error callback failed",
                ),
              ),
            )
          } else {
            yield* Effect.logWarning(
              `[Flowmark] Could not deliver ${event.type} for ${event.workflow}`,
              {
                error: error._tag,
              },
            )
          }
        })

        const deliver = Effect.fn("Flowmark.DeliveryQueue.deliver")(function* (
          event: WorkflowEvent,
        ) {
          const decoded = yield* decodeWorkflowEvent(event)
          yield* transport
            .emit(decoded)
            .pipe(
              Effect.catchCause((cause) =>
                Effect.fail(
                  new WorkflowTransportError({ event: decoded, cause }),
                ),
              ),
            )
        })

        const enqueue = Effect.fn("Flowmark.DeliveryQueue.enqueue")(
          function* (event: WorkflowEvent, ordering: Semaphore.Semaphore) {
            const isClosed = yield* Ref.get(closed)
            if (isClosed || (yield* FiberSet.size(pending)) >= 1000) {
              return yield* report(
                new FlowmarkQueueError({
                  event,
                  reason: isClosed ? "closed" : "capacity",
                }),
                event,
              )
            }
            yield* FiberSet.run(
              pending,
              ordering.withPermits(1)(
                deliver(event).pipe(
                  Effect.catch((error) => report(error, event)),
                  Effect.catchCause((cause) =>
                    report(new WorkflowTransportError({ event, cause }), event),
                  ),
                ),
              ),
            )
          },
          queueAccess.withPermits(1),
          Effect.asVoid,
        )

        const flush = Effect.gen(function* () {
          yield* FiberSet.awaitEmpty(pending)
          const errors = yield* Ref.getAndSet(failures, [])
          if (errors.length > 0) {
            return yield* Effect.fail(
              new FlowmarkDeliveryError({ failures: errors }),
            )
          }
        })

        return DeliveryQueue.of({
          enqueue,
          flush,
          shutdown: queueAccess
            .withPermits(1)(Ref.set(closed, true))
            .pipe(Effect.andThen(flush)),
        })
      }),
    )
  }
}
