import { withWorkflowDefinitions } from "../workflows/define-workflow.js"
import { Effect, Layer, ManagedRuntime, Result, Schema } from "effect"
import { FlowmarkConfigError } from "../errors/index.js"
import { DeliveryQueue } from "../delivery/delivery-queue.js"
import { WorkflowTransport } from "../delivery/ports/workflow-transport.js"
import { WorkflowEngine } from "../workflows/workflow-engine.js"
import { WorkflowEvents } from "../workflows/workflow-events.js"
import { WorkflowRuns } from "../workflows/run-lifecycle.js"
import { withOperationCallback } from "../utils/operation-callback.js"
import { splitOperationArgs } from "../utils/operation-args.js"
import type {
  DeliveryOptions,
  FlowmarkClient,
  InstrumentationErrorHandler,
  WorkflowOperation,
  WorkflowOperationOptions,
  WorkflowRunOptions,
} from "../types/index.js"
import type { WorkflowStepName, WorkflowProgress } from "@flowmarkdev/core"

/** Shared execution boundary; this module has no Node.js or framework imports. */
export function makeClient(
  transport: Layer.Layer<WorkflowTransport>,
  onError?: InstrumentationErrorHandler,
  defaults: Pick<WorkflowRunOptions, "environment" | "release"> = {},
  deliveryOptions: DeliveryOptions = {},
): FlowmarkClient {
  const options = Result.match(
    Schema.decodeUnknownResult(
      Schema.Struct({
        progress: Schema.optional(Schema.Literals(["all", "latest"])),
      }),
    )(deliveryOptions),
    {
      onFailure: (cause) => {
        throw new FlowmarkConfigError({ cause })
      },
      onSuccess: (value) => value,
    },
  )
  const delivery = DeliveryQueue.layer(onError, options).pipe(
    Layer.provide(transport),
  )
  const events = WorkflowEvents.layer.pipe(Layer.provideMerge(delivery))
  const runs = WorkflowRuns.layer.pipe(Layer.provideMerge(events))
  const runtime = ManagedRuntime.make(
    WorkflowEngine.layer.pipe(Layer.provideMerge(runs)),
  )
  const engine = runtime.runSync(WorkflowEngine)
  const queue = runtime.runSync(DeliveryQueue)
  let finalHealth: ReturnType<FlowmarkClient["deliveryHealth"]> | undefined
  let shutdownResult: Promise<void> | undefined

  const runMarker = (command: Effect.Effect<void>) => {
    if (shutdownResult) {
      console.warn("[Flowmark] Ignored workflow marker after client shutdown")
      return
    }
    runtime.runSync(command)
  }

  return withWorkflowDefinitions<Omit<FlowmarkClient, "defineWorkflow">>({
    deliveryHealth: () => finalHealth ?? runtime.runSync(queue.health),
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
      function operation(
        name: WorkflowStepName,
        options?: WorkflowOperationOptions,
      ): WorkflowOperation
      function operation<T>(
        name: WorkflowStepName,
        callback: () => PromiseLike<T>,
        options?: WorkflowOperationOptions,
      ): Promise<T>
      function operation<T>(
        name: WorkflowStepName,
        callbackOrOptions?: (() => PromiseLike<T>) | WorkflowOperationOptions,
        options?: WorkflowOperationOptions,
      ): WorkflowOperation | Promise<T> {
        const args = splitOperationArgs(callbackOrOptions, options)
        const effectHandle = shutdownResult
          ? {
              operationId: globalThis.crypto.randomUUID(),
              done: Effect.void,
              fail: () => Effect.void,
            }
          : runtime.runSync(handle.operation(name, args.options))
        const operationHandle: WorkflowOperation = {
          operationId: effectHandle.operationId,
          done: () => runMarker(effectHandle.done),
          fail: (failure) => runMarker(effectHandle.fail(failure)),
        }
        if (args.callback === undefined) {
          return operationHandle
        }
        return withOperationCallback(operationHandle, args.callback)
      }
      return {
        runId: handle.runId,
        step: (name, stepOptions) => runMarker(handle.step(name, stepOptions)),
        done: (doneOptions) => runMarker(handle.done(doneOptions)),
        fail: (options) => runMarker(handle.fail(options)),
        error: (error) => runMarker(handle.error(error)),
        setProperties: (properties) =>
          runMarker(handle.setProperties(properties)),
        report: (snapshot) => runMarker(handle.report(snapshot)),
        operation,
        progress: (progress: WorkflowProgress) =>
          runMarker(handle.progress(progress)),
      }
    },
    flush() {
      return shutdownResult ?? runtime.runPromise(queue.flush)
    },
    shutdown() {
      shutdownResult ??= runtime.runPromise(queue.shutdown).finally(() => {
        finalHealth = runtime.runSync(queue.health)
        return runtime.dispose()
      })
      return shutdownResult
    },
  })
}
