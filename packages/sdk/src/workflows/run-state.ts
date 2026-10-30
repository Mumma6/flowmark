import { Context, Effect, Layer, Option, Ref } from "effect"
import type { WorkflowDoneOptions } from "../types/index.js"

/** One instance per run; state transitions do not construct or deliver events. */
export class RunState extends Context.Service<RunState>()(
  "@flowmarkdev/node/RunState",
  {
    make: Effect.gen(function* () {
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

      const requestCompletion = Effect.fn(
        "Flowmark.RunState.requestCompletion",
      )(function* (options?: WorkflowDoneOptions) {
        if (!(yield* isOpen)) {
          return Option.none<WorkflowDoneOptions | undefined>()
        }

        yield* Ref.set(completionRequested, true)
        yield* Ref.set(pendingCompletion, options)

        return (yield* Ref.get(activeOperations)).size > 0
          ? Option.none<WorkflowDoneOptions | undefined>()
          : Option.some(options)
      })

      const fail = Effect.gen(function* () {
        if (yield* Ref.getAndSet(finished, true)) {
          return false
        }

        yield* Ref.set(completionRequested, false)
        yield* Ref.set(pendingCompletion, undefined)
        yield* Ref.set(activeOperations, new Set())

        return true
      })

      const openOperation = Effect.fn("Flowmark.RunState.openOperation")(
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

      const completionIfReady = Effect.gen(function* () {
        const active = yield* Ref.get(activeOperations)

        return active.size === 0 && (yield* Ref.get(completionRequested))
          ? Option.some(yield* Ref.get(pendingCompletion))
          : Option.none<WorkflowDoneOptions | undefined>()
      })

      return {
        isOpen,
        isFinished,
        requestCompletion,
        fail,
        finish: Ref.getAndSet(finished, true).pipe(
          Effect.map((wasFinished) => !wasFinished),
        ),
        openOperation,
        closeOperation,
        completionIfReady,
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
