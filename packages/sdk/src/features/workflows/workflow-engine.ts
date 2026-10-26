import { Clock, Context, Effect, Layer, Ref } from "effect"
import type {
  WorkflowError,
  WorkflowEvent,
  WorkflowName,
  WorkflowOperationFailure,
  WorkflowProperties,
  WorkflowProgress,
  WorkflowStepName,
} from "@flowmarkdev/core"
import type {
  WorkflowDoneOptions,
  WorkflowFailOptions,
  WorkflowOperationOptions,
  WorkflowRunOptions,
  WorkflowStepOptions,
} from "../../types/index.js"
import { DeliveryQueue } from "../delivery/delivery-queue.js"

export interface WorkflowOperationHandle {
  readonly operationId: string
  readonly done: Effect.Effect<void>
  readonly fail: (failure: WorkflowOperationFailure) => Effect.Effect<void>
}

export interface WorkflowHandle {
  readonly runId: string
  readonly step: (
    name: WorkflowStepName,
    options?: WorkflowStepOptions,
  ) => Effect.Effect<void>
  readonly done: (options?: WorkflowDoneOptions) => Effect.Effect<void>
  readonly fail: (options: WorkflowFailOptions) => Effect.Effect<void>
  readonly error: (error: WorkflowError) => Effect.Effect<void>
  readonly setProperties: (
    properties: WorkflowProperties,
  ) => Effect.Effect<void>
  readonly operation: (
    name: WorkflowStepName,
    options?: WorkflowOperationOptions,
  ) => Effect.Effect<WorkflowOperationHandle>
  readonly progress: (progress: WorkflowProgress) => Effect.Effect<void>
}

export interface WorkflowEngineService {
  readonly start: (
    name: WorkflowName,
    options: WorkflowRunOptions,
  ) => Effect.Effect<WorkflowHandle>
}

export class WorkflowEngine extends Context.Tag(
  "@flowmarkdev/node/WorkflowEngine",
)<WorkflowEngine, WorkflowEngineService>() {
  static readonly layer = Layer.effect(
    WorkflowEngine,
    Effect.gen(function* () {
      const delivery = yield* DeliveryQueue

      const start = Effect.fn("Flowmark.WorkflowEngine.start")(function* (
        workflow: WorkflowName,
        options: WorkflowRunOptions,
      ) {
        const runId =
          options.id ??
          (yield* Effect.sync(() => globalThis.crypto.randomUUID()))
        const ordering = yield* Effect.makeSemaphore(1)
        const finished = yield* Ref.make(false)
        const completionRequested = yield* Ref.make(false)
        const pendingCompletion = yield* Ref.make<
          WorkflowDoneOptions | undefined
        >(undefined)
        const activeOperations = yield* Ref.make<ReadonlySet<string>>(new Set())

        const record = Effect.fn("Flowmark.WorkflowEngine.record")(function* (
          createEvent: (timestamp: string) => WorkflowEvent,
        ) {
          const now = yield* Clock.currentTimeMillis
          yield* delivery.enqueue(
            createEvent(new Date(now).toISOString()),
            ordering,
          )
        })

        yield* record((timestamp) => ({
          type: "started",
          workflow,
          runId,
          timestamp,
          ...(options.properties === undefined
            ? {}
            : { properties: options.properties }),
          ...(options.environment === undefined
            ? {}
            : { environment: options.environment }),
          ...(options.release === undefined
            ? {}
            : { release: options.release }),
          ...(options.correlationId === undefined
            ? {}
            : { correlationId: options.correlationId }),
          ...(options.parentRunId === undefined
            ? {}
            : { parentRunId: options.parentRunId }),
        }))

        const step = Effect.fn("Flowmark.WorkflowEngine.step")(function* (
          name: WorkflowStepName,
          stepOptions?: WorkflowStepOptions,
        ) {
          if (
            (yield* Ref.get(finished)) ||
            (yield* Ref.get(completionRequested))
          ) {
            return
          }
          yield* record((timestamp) => ({
            type: "step",
            workflow,
            runId,
            timestamp,
            step: name,
            ...(stepOptions?.properties === undefined
              ? {}
              : { properties: stepOptions.properties }),
          }))
        })
        const complete = Effect.fn("Flowmark.WorkflowEngine.complete")(
          function* (doneOptions?: WorkflowDoneOptions) {
            if (yield* Ref.getAndSet(finished, true)) {
              return
            }
            yield* record((timestamp) => ({
              type: "completed",
              workflow,
              runId,
              timestamp,
              ...(doneOptions?.result === undefined
                ? {}
                : { result: doneOptions.result }),
            }))
          },
        )
        const done = Effect.fn("Flowmark.WorkflowEngine.done")(function* (
          doneOptions?: WorkflowDoneOptions,
        ) {
          if (
            (yield* Ref.get(finished)) ||
            (yield* Ref.get(completionRequested))
          ) {
            return
          }
          yield* Ref.set(completionRequested, true)
          yield* Ref.set(pendingCompletion, doneOptions)
          if ((yield* Ref.get(activeOperations)).size > 0) {
            return
          }
          yield* complete(doneOptions)
        })
        const fail = Effect.fn("Flowmark.WorkflowEngine.fail")(function* (
          options: WorkflowFailOptions,
        ) {
          if (yield* Ref.getAndSet(finished, true)) {
            return
          }
          yield* Ref.set(completionRequested, false)
          yield* Ref.set(pendingCompletion, undefined)
          yield* Ref.set(activeOperations, new Set())
          const { result, ...failure } = options
          yield* record((timestamp) => ({
            type: "failed",
            workflow,
            runId,
            timestamp,
            failure,
            ...(result === undefined ? {} : { result }),
          }))
        })

        const error = Effect.fn("Flowmark.WorkflowEngine.error")(function* (
          failure: WorkflowError,
        ) {
          if (
            (yield* Ref.get(finished)) ||
            (yield* Ref.get(completionRequested))
          ) {
            return
          }
          yield* record((timestamp) => ({
            type: "error",
            workflow,
            runId,
            timestamp,
            error: failure,
          }))
        })
        const setProperties = Effect.fn(
          "Flowmark.WorkflowEngine.setProperties",
        )(function* (properties: WorkflowProperties) {
          if (
            yield* Ref.get(finished) || (yield* Ref.get(completionRequested))
          ) {
            return
          }
          yield* record((timestamp) => ({
            type: "properties",
            workflow,
            runId,
            timestamp,
            properties,
          }))
        })

        const progress = Effect.fn("Flowmark.WorkflowEngine.progress")(
          function* (progress: WorkflowProgress) {
            if (
              (yield* Ref.get(finished)) ||
              (yield* Ref.get(completionRequested))
            ) {
              return
            }
            yield* record((timestamp) => ({
              type: "progress",
              workflow,
              runId,
              timestamp,
              ...progress,
            }))
          },
        )

        const operation = Effect.fn("Flowmark.WorkflowEngine.operation")(
          function* (
            operationName: WorkflowStepName,
            operationOptions?: WorkflowOperationOptions,
          ) {
            const operationId = yield* Effect.sync(() =>
              globalThis.crypto.randomUUID(),
            )
            const startedAt = yield* Effect.sync(() => performance.now())
            const operationFinished = yield* Ref.make(false)
            const canStart =
              !(yield* Ref.get(finished)) &&
              !(yield* Ref.get(completionRequested))
            if (canStart) {
              yield* Ref.update(activeOperations, (active) =>
                new Set(active).add(operationId),
              )
              yield* record((timestamp) => ({
                type: "operation_started",
                workflow,
                runId,
                timestamp,
                operationId,
                operationName,
                ...(operationOptions?.properties === undefined
                  ? {}
                  : { properties: operationOptions.properties }),
              }))
            }
            const duration = Effect.sync(() =>
              Math.max(0, performance.now() - startedAt),
            )
            const done = Effect.gen(function* () {
              if (yield* Ref.getAndSet(operationFinished, true)) {
                return
              }
              if ((yield* Ref.get(finished)) || !canStart) {
                return
              }
              if (canStart) {
                yield* Ref.update(activeOperations, (active) => {
                  const next = new Set(active)
                  next.delete(operationId)
                  return next
                })
              }
              const durationMs = yield* duration
              yield* record((timestamp) => ({
                type: "operation_completed",
                workflow,
                runId,
                timestamp,
                operationId,
                operationName,
                durationMs,
              }))
              const active = yield* Ref.get(activeOperations)
              if (active.size === 0 && (yield* Ref.get(completionRequested))) {
                yield* complete(yield* Ref.get(pendingCompletion))
              }
            })
            const fail = Effect.fn("Flowmark.WorkflowEngine.operation.fail")(
              function* (failure: WorkflowOperationFailure) {
                if (yield* Ref.getAndSet(operationFinished, true)) {
                  return
                }
                if ((yield* Ref.get(finished)) || !canStart) {
                  return
                }
                if (canStart) {
                  yield* Ref.update(activeOperations, (active) => {
                    const next = new Set(active)
                    next.delete(operationId)
                    return next
                  })
                }
                const durationMs = yield* duration
                yield* record((timestamp) => ({
                  type: "operation_failed",
                  workflow,
                  runId,
                  timestamp,
                  operationId,
                  operationName,
                  durationMs,
                  failure,
                }))
                const active = yield* Ref.get(activeOperations)
                if (
                  active.size === 0 &&
                  (yield* Ref.get(completionRequested))
                ) {
                  yield* complete(yield* Ref.get(pendingCompletion))
                }
              },
            )
            return { operationId, done, fail } satisfies WorkflowOperationHandle
          },
        )

        return {
          runId,
          step,
          done,
          fail,
          error,
          setProperties,
          operation,
          progress,
        } satisfies WorkflowHandle
      })

      return WorkflowEngine.of({ start })
    }),
  )
}
