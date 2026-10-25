import { Effect, Layer, ManagedRuntime } from "effect"
import { FlowmarkConfigError } from "../errors/index.js"
import { DeliveryQueue } from "../features/delivery/delivery-queue.js"
import { WorkflowTransport } from "../features/delivery/ports/workflow-transport.js"
import { WorkflowEngine } from "../features/workflows/workflow-engine.js"
import { withOperationCallback } from "../utils/operation-callback.js"
import type {
  FlowmarkClient,
  InstrumentationErrorHandler,
  WorkflowOperation,
  WorkflowRunOptions,
} from "../types/index.js"
import type {
  WorkflowFailure,
  WorkflowStepName,
  WorkflowProgress,
} from "@flowmark/core"

/** Shared execution boundary; this module has no Node.js or framework imports. */
export function makeClient(
  transport: Layer.Layer<WorkflowTransport>,
  onError?: InstrumentationErrorHandler,
  defaults: Pick<WorkflowRunOptions, "environment" | "release"> = {},
): FlowmarkClient {
  const delivery = DeliveryQueue.layer(onError).pipe(Layer.provide(transport))
  const runtime = ManagedRuntime.make(
    WorkflowEngine.layer.pipe(Layer.provideMerge(delivery)),
  )
  const engine = runtime.runSync(WorkflowEngine)
  const queue = runtime.runSync(DeliveryQueue)
  let shutdownResult: Promise<void> | undefined

  const runMarker = (command: Effect.Effect<void>) => {
    if (shutdownResult) {
      console.warn("[Flowmark] Ignored workflow marker after client shutdown")
      return
    }
    runtime.runSync(command)
  }

  return {
    workflow(name, options = {}) {
      if (shutdownResult) {
        throw new FlowmarkConfigError({ cause: "Client has been shut down" })
      }
      const handle = runtime.runSync(
        engine.start(name, {
          ...defaults,
          ...options,
          environment: options.environment ?? defaults.environment,
          release: options.release ?? defaults.release,
        }),
      )
      function operation(name: WorkflowStepName): WorkflowOperation
      function operation<T>(
        name: WorkflowStepName,
        callback: () => PromiseLike<T>,
      ): Promise<T>
      function operation<T>(
        name: WorkflowStepName,
        callback?: () => PromiseLike<T>,
      ): WorkflowOperation | Promise<T> {
        const effectHandle = shutdownResult
          ? {
              operationId: globalThis.crypto.randomUUID(),
              done: Effect.void,
              fail: () => Effect.void,
            }
          : runtime.runSync(handle.operation(name))
        const operationHandle: WorkflowOperation = {
          operationId: effectHandle.operationId,
          done: () => runMarker(effectHandle.done),
          fail: (reason?: string | WorkflowFailure) =>
            runMarker(effectHandle.fail(reason)),
        }
        if (callback === undefined) {
          return operationHandle
        }
        return withOperationCallback(operationHandle, callback)
      }
      return {
        runId: handle.runId,
        step: (name, stepOptions) => runMarker(handle.step(name, stepOptions)),
        done: (doneOptions) => runMarker(handle.done(doneOptions)),
        fail: (reason) => runMarker(handle.fail(reason)),
        error: (error) => runMarker(handle.error(error)),
        setProperties: (properties) =>
          runMarker(handle.setProperties(properties)),
        operation,
        progress: (progress: WorkflowProgress) =>
          runMarker(handle.progress(progress)),
      }
    },
    flush() {
      return shutdownResult ?? runtime.runPromise(queue.flush)
    },
    shutdown() {
      shutdownResult ??= runtime
        .runPromise(queue.shutdown)
        .finally(() => runtime.dispose())
      return shutdownResult
    },
  }
}
