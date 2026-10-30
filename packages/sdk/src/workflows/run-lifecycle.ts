import { Context, Effect, Layer, Option } from "effect"
import type { WorkflowName } from "@flowmarkdev/core"
import type {
  WorkflowDoneOptions,
  WorkflowFailOptions,
  WorkflowRunOptions,
} from "../types/index.js"
import { completedEvent, failedEvent, startedEvent } from "./events.js"
import { WorkflowEvents } from "./workflow-events.js"
import { RunState } from "./run-state.js"
import type { RunLifecycle } from "./types.js"

export interface WorkflowRunsService {
  readonly start: (
    workflow: WorkflowName,
    options: WorkflowRunOptions,
  ) => Effect.Effect<RunLifecycle>
}

/** Coordinates terminal events against isolated run state. */
export class WorkflowRuns extends Context.Service<
  WorkflowRuns,
  WorkflowRunsService
>()("@flowmarkdev/node/WorkflowRuns") {
  static readonly layer = Layer.effect(
    WorkflowRuns,
    Effect.gen(function* () {
      const events = yield* WorkflowEvents

      const start = Effect.fn("Flowmark.WorkflowRuns.start")(
        function* (workflow: WorkflowName, options: WorkflowRunOptions) {
          const runId =
            options.id ??
            (yield* Effect.sync(() => globalThis.crypto.randomUUID()))

          const { record } = yield* events.forRun(workflow, runId)

          const state = yield* RunState

          const complete = Effect.fn("Flowmark.WorkflowRuns.complete")(
            function* (options?: WorkflowDoneOptions) {
              if (yield* state.finish) {
                yield* record(completedEvent(options))
              }
            },
          )

          const completeRequested = Option.match({
            onNone: () => Effect.void,
            onSome: complete,
          })

          const done = Effect.fn("Flowmark.WorkflowRuns.done")(
            (options?: WorkflowDoneOptions) =>
              state
                .requestCompletion(options)
                .pipe(Effect.flatMap(completeRequested)),
          )

          const fail = Effect.fn("Flowmark.WorkflowRuns.fail")(function* (
            options: WorkflowFailOptions,
          ) {
            if (yield* state.fail) {
              yield* record(failedEvent(options))
            }
          })

          yield* record(startedEvent(options))

          return {
            runId,
            record,
            isFinished: state.isFinished,
            isOpen: state.isOpen,
            done,
            fail,
            openOperation: state.openOperation,
            closeOperation: state.closeOperation,
            completeIfReady: state.completionIfReady.pipe(
              Effect.flatMap(completeRequested),
            ),
          } satisfies RunLifecycle
        },
        Effect.provide(RunState.layer, { local: true }),
      )

      return WorkflowRuns.of({ start })
    }),
  )
}
