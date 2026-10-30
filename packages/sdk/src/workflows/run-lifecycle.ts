import { Context, Effect, Layer, Ref } from "effect"
import type { WorkflowName } from "@flowmarkdev/core"
import type {
  WorkflowDoneOptions,
  WorkflowFailOptions,
  WorkflowRunOptions,
} from "../types/index.js"
import { completedEvent, failedEvent, startedEvent } from "./events.js"
import { WorkflowEvents, type RunEventRecorder } from "./workflow-events.js"

/** Run-local state shared by markers and operation handles, never by other runs. */
export interface RunLifecycle extends RunEventRecorder {
  readonly runId: string
  readonly isOpen: Effect.Effect<boolean>
  readonly isFinished: Effect.Effect<boolean>
  readonly done: (options?: WorkflowDoneOptions) => Effect.Effect<void>
  readonly fail: (options: WorkflowFailOptions) => Effect.Effect<void>
  readonly openOperation: (operationId: string) => Effect.Effect<boolean>
  readonly closeOperation: (operationId: string) => Effect.Effect<void>
  /** Called after recording an operation terminal, preserving delivery order. */
  readonly completeIfReady: Effect.Effect<void>
}

export interface WorkflowRunsService {
  readonly start: (
    workflow: WorkflowName,
    options: WorkflowRunOptions,
  ) => Effect.Effect<RunLifecycle>
}

/** Owns completion deferral and terminal state, without owning application work. */
export class WorkflowRuns extends Context.Tag("@flowmarkdev/node/WorkflowRuns")<
  WorkflowRuns,
  WorkflowRunsService
>() {
  static readonly layer = Layer.effect(
    WorkflowRuns,
    Effect.gen(function* () {
      const events = yield* WorkflowEvents
      const start = Effect.fn("Flowmark.WorkflowRuns.start")(function* (
        workflow: WorkflowName,
        options: WorkflowRunOptions,
      ) {
        const runId =
          options.id ??
          (yield* Effect.sync(() => globalThis.crypto.randomUUID()))
        const { record } = yield* events.forRun(workflow, runId)
        const finished = yield* Ref.make(false)
        const completionRequested = yield* Ref.make(false)
        const pendingCompletion = yield* Ref.make<
          WorkflowDoneOptions | undefined
        >(undefined)
        const activeOperations = yield* Ref.make<ReadonlySet<string>>(new Set())

        const isFinished = Ref.get(finished)
        const isOpen = Effect.gen(function* () {
          return !(yield* isFinished) && !(yield* Ref.get(completionRequested))
        })
        const complete = Effect.fn("Flowmark.WorkflowRuns.complete")(function* (
          options?: WorkflowDoneOptions,
        ) {
          if (yield* Ref.getAndSet(finished, true)) {
            return
          }
          yield* record(completedEvent(options))
        })
        const done = Effect.fn("Flowmark.WorkflowRuns.done")(function* (
          options?: WorkflowDoneOptions,
        ) {
          if (!(yield* isOpen)) {
            return
          }
          yield* Ref.set(completionRequested, true)
          yield* Ref.set(pendingCompletion, options)
          if ((yield* Ref.get(activeOperations)).size > 0) {
            return
          }
          yield* complete(options)
        })
        const fail = Effect.fn("Flowmark.WorkflowRuns.fail")(function* (
          options: WorkflowFailOptions,
        ) {
          if (yield* Ref.getAndSet(finished, true)) {
            return
          }
          yield* Ref.set(completionRequested, false)
          yield* Ref.set(pendingCompletion, undefined)
          yield* Ref.set(activeOperations, new Set())
          yield* record(failedEvent(options))
        })
        const openOperation = Effect.fn("Flowmark.WorkflowRuns.openOperation")(
          function* (operationId: string) {
            const canStart = yield* isOpen
            if (canStart) {
              yield* Ref.update(activeOperations, (active) =>
                new Set(active).add(operationId),
              )
            }
            return canStart
          },
        )
        const closeOperation = (operationId: string) =>
          Ref.update(activeOperations, (active) => {
            const next = new Set(active)
            next.delete(operationId)
            return next
          })
        const completeIfReady = Effect.gen(function* () {
          const active = yield* Ref.get(activeOperations)
          if (active.size === 0 && (yield* Ref.get(completionRequested))) {
            yield* complete(yield* Ref.get(pendingCompletion))
          }
        })

        yield* record(startedEvent(options))
        return {
          runId,
          record,
          isFinished,
          isOpen,
          done,
          fail,
          openOperation,
          closeOperation,
          completeIfReady,
        } satisfies RunLifecycle
      })
      return WorkflowRuns.of({ start })
    }),
  )
}
