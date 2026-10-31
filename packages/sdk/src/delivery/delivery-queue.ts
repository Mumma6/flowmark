import { Context, Effect, FiberSet, Layer, Ref, Semaphore } from "effect"
import { decodeWorkflowEvent, type WorkflowEvent } from "@flowmarkdev/core"
import {
  FlowmarkDeliveryError,
  FlowmarkQueueError,
  WorkflowTransportError,
  type DeliveryFailure,
} from "../errors/index.js"
import type {
  DeliveryHealth,
  DeliveryOptions,
  InstrumentationErrorHandler,
} from "../types/index.js"
import { WorkflowTransport } from "./ports/workflow-transport.js"

export const emptyDeliveryHealth = (): DeliveryHealth => ({
  pending: 0,
  pendingProgress: 0,
  coalesced: 0,
  dropped: 0,
  failed: 0,
  lastFailure: null,
})

export interface DeliveryQueueService {
  readonly diagnose: (
    error: DeliveryFailure,
    event: WorkflowEvent,
  ) => Effect.Effect<void>
  readonly enqueue: (
    event: WorkflowEvent,
    ordering: Semaphore.Semaphore,
  ) => Effect.Effect<void>
  readonly health: Effect.Effect<DeliveryHealth>
  readonly flush: Effect.Effect<void, FlowmarkDeliveryError>
  readonly shutdown: Effect.Effect<void, FlowmarkDeliveryError>
}

const capacity = 1000
const snapshotCapacity = 900
const failureSampleSize = 20

export class DeliveryQueue extends Context.Service<
  DeliveryQueue,
  DeliveryQueueService
>()("@flowmarkdev/node/DeliveryQueue") {
  static layer(
    onError?: InstrumentationErrorHandler,
    options: DeliveryOptions = {},
  ) {
    return Layer.effect(
      DeliveryQueue,
      Effect.gen(function* () {
        const transport = yield* WorkflowTransport
        const pending = yield* FiberSet.make<void, never>()
        const failures = yield* Ref.make({
          count: 0,
          sample: [] as ReadonlyArray<DeliveryFailure>,
        })
        const counters = yield* Ref.make(emptyDeliveryHealth())
        const closed = yield* Ref.make(false)
        const queueAccess = yield* Semaphore.make(1)
        // Only unsent slots are replaceable. Map size cannot exceed pending fibers.
        const progressSlots = new Map<
          Semaphore.Semaphore,
          { event: WorkflowEvent }
        >()

        const report = Effect.fn("Flowmark.DeliveryQueue.report")(function* (
          error: DeliveryFailure,
          event: WorkflowEvent,
        ) {
          yield* Ref.update(failures, ({ count, sample }) => ({
            count: count + 1,
            sample:
              sample.length < failureSampleSize ? [...sample, error] : sample,
          }))
          yield* Ref.update(counters, (health) => ({
            ...health,
            dropped:
              health.dropped + (error._tag === "FlowmarkQueueError" ? 1 : 0),
            failed:
              health.failed + (error._tag === "FlowmarkQueueError" ? 0 : 1),
            lastFailure: { type: error._tag },
          }))
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
              { error: error._tag },
            )
          }
        })

        const enqueue = Effect.fn("Flowmark.DeliveryQueue.enqueue")(
          function* (event: WorkflowEvent, ordering: Semaphore.Semaphore) {
            // Validate every submission, including snapshots that might replace another.
            const decoded = yield* decodeWorkflowEvent(event).pipe(
              Effect.catch((error) =>
                report(error, event).pipe(Effect.as(undefined)),
              ),
              Effect.catchCause((cause) =>
                report(
                  new WorkflowTransportError({ event, cause }),
                  event,
                ).pipe(Effect.as(undefined)),
              ),
            )
            if (!decoded) {
              return
            }
            if (yield* Ref.get(closed)) {
              return yield* report(
                new FlowmarkQueueError({ event, reason: "closed" }),
                event,
              )
            }
            const previous = progressSlots.get(ordering)
            if (decoded.type === "progress" && previous) {
              previous.event = decoded
              yield* Ref.update(counters, (health) => ({
                ...health,
                coalesced: health.coalesced + 1,
              }))
              return
            }
            // Every intervening marker seals the previous progress slot in its position.
            progressSlots.delete(ordering)
            const limit =
              decoded.type === "progress" || decoded.type === "report"
                ? snapshotCapacity
                : capacity
            if ((yield* FiberSet.size(pending)) >= limit) {
              return yield* report(
                new FlowmarkQueueError({ event, reason: "capacity" }),
                event,
              )
            }
            const slot = { event: decoded }
            if (options.progress === "latest" && decoded.type === "progress") {
              progressSlots.set(ordering, slot)
            }
            yield* FiberSet.run(
              pending,
              ordering.withPermits(1)(
                Effect.gen(function* () {
                  if (progressSlots.get(ordering) === slot) {
                    progressSlots.delete(ordering)
                  }
                  yield* transport.emit(slot.event)
                }).pipe(
                  Effect.catchCause((cause) =>
                    report(
                      new WorkflowTransportError({ event: slot.event, cause }),
                      slot.event,
                    ),
                  ),
                ),
              ),
            )
          },
          queueAccess.withPermits(1),
          Effect.asVoid,
        )

        const health = Effect.gen(function* () {
          const counts = yield* Ref.get(counters)
          return {
            ...counts,
            lastFailure:
              counts.lastFailure === null ? null : { ...counts.lastFailure },
            pending: yield* FiberSet.size(pending),
            pendingProgress: progressSlots.size,
          }
        })
        const flush = Effect.gen(function* () {
          // A later submission cannot replace evidence already included in a drain boundary.
          yield* queueAccess.withPermits(1)(
            Effect.sync(() => progressSlots.clear()),
          )
          yield* FiberSet.awaitEmpty(pending)
          const errors = yield* Ref.getAndSet(failures, {
            count: 0,
            sample: [],
          })
          if (errors.count > 0) {
            return yield* Effect.fail(
              new FlowmarkDeliveryError({
                failures: errors.sample,
                failureCount: errors.count,
                omittedFailureCount: errors.count - errors.sample.length,
              }),
            )
          }
        })
        return DeliveryQueue.of({
          diagnose: report,
          enqueue,
          health,
          flush,
          shutdown: queueAccess
            .withPermits(1)(Ref.set(closed, true))
            .pipe(Effect.andThen(flush)),
        })
      }),
    )
  }
}
