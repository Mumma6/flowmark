import { ExpectationReferenceSchema } from "@flowmarkdev/core"
import type {
  ExpectationReference,
  ExpectationResolution,
  ExpectationCancellation,
  ExpectationEvent,
} from "@flowmarkdev/core"
import { FlowmarkExpectationError } from "../errors/index.js"
import {
  genericOperationFailure,
  mapOperationFailure,
} from "../utils/map-operation-failure.js"
import { withWorkflowDefinitions } from "../workflows/define-workflow.js"
import { Effect, Layer, ManagedRuntime, Result, Schema } from "effect"
import { FlowmarkConfigError, type DeliveryFailure } from "../errors/index.js"
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
import type {
  WorkflowEvent,
  WorkflowStepName,
  WorkflowProgress,
} from "@flowmarkdev/core"

/** Internal client capability; not exported from public SDK entry points. */
export const reportInstrumentationFailure = Symbol(
  "Flowmark.reportInstrumentationFailure",
)
type InternalClient = FlowmarkClient & {
  readonly [reportInstrumentationFailure]: (
    error: DeliveryFailure,
    event: WorkflowEvent,
  ) => void
}

/** Shared execution boundary; this module has no Node.js or framework imports. */
export function makeClient(
  transport: Layer.Layer<WorkflowTransport>,
  onError?: InstrumentationErrorHandler,
  defaults: Pick<WorkflowRunOptions, "environment" | "release"> = {},
  deliveryOptions: DeliveryOptions = {},
  source: "server" | "browser" | "proxy" = "server",
): InternalClient {
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
  const eventService = runtime.runSync(WorkflowEvents)
  let finalHealth: ReturnType<FlowmarkClient["deliveryHealth"]> | undefined
  let shutdownResult: Promise<void> | undefined

  const runMarker = (command: Effect.Effect<void>) => {
    if (shutdownResult) {
      console.warn("[Flowmark] Ignored workflow marker after client shutdown")
      return
    }
    runtime.runSync(command)
  }

  const settle = (
    reference: ExpectationReference,
    options: ExpectationResolution | ExpectationCancellation,
    type: "expectation_resolved" | "expectation_cancelled",
  ) =>
    runMarker(
      Effect.gen(function* () {
        const event = {
          ...options,
          type,
          workflow: reference.workflow,
          runId: reference.runId,
          expectationId: reference.expectationId,
          timestamp: new Date().toISOString(),
        } as ExpectationEvent
        if (!Schema.is(ExpectationReferenceSchema)(reference)) {
          return yield* queue.diagnose(
            new FlowmarkExpectationError({ reason: "invalid-input" }),
            event,
          )
        }
        if (
          source === "proxy" ||
          (source === "browser" && !reference.workflow.startsWith("browser."))
        ) {
          return yield* queue.diagnose(
            new FlowmarkExpectationError({ reason: "source-forbidden" }),
            event,
          )
        }
        const recorder = yield* eventService.forRun(
          reference.workflow,
          reference.runId,
        )
        yield* recorder.record(event)
      }).pipe(
        Effect.catchCause(() =>
          queue.diagnose(
            new FlowmarkExpectationError({ reason: "invalid-input" }),
            {
              type,
              workflow: "invalid",
              runId: "invalid",
              expectationId: "invalid",
              timestamp: new Date().toISOString(),
              ...(type === "expectation_cancelled" ? { code: "invalid" } : {}),
            } as ExpectationEvent,
          ),
        ),
      ),
    )
  return withWorkflowDefinitions<Omit<InternalClient, "defineWorkflow">>({
    resolveExpectation: (reference, options = {}) =>
      settle(reference, options, "expectation_resolved"),
    cancelExpectation: (reference, options) =>
      settle(reference, options, "expectation_cancelled"),
    [reportInstrumentationFailure]: (error, event) =>
      runMarker(queue.diagnose(error, event)),
    deliveryHealth: () => finalHealth ?? runtime.runSync(queue.health),
    workflow(name, options = {}) {
      const workflowName =
        source === "browser" && !name.startsWith("browser.")
          ? `browser.${name}`
          : name
      const nameOfWorkflow = workflowName
      if (shutdownResult) {
        throw new FlowmarkConfigError({ cause: "Client has been shut down" })
      }
      const handle = runtime.runSync(
        engine.start(workflowName, {
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
        return withOperationCallback(operationHandle, args.callback, (cause) =>
          runMarker(
            mapOperationFailure(cause, args.options).pipe(
              Effect.catchTag("FlowmarkErrorMappingError", (error) =>
                queue
                  .diagnose(error, {
                    type: "operation_failed",
                    workflow: nameOfWorkflow,
                    runId: handle.runId,
                    operationId: operationHandle.operationId,
                    operationName: name,
                    durationMs: 0,
                    timestamp: new Date().toISOString(),
                    failure: genericOperationFailure,
                  })
                  .pipe(Effect.as(genericOperationFailure)),
              ),
              Effect.flatMap(effectHandle.fail),
            ),
          ),
        )
      }
      return {
        runId: handle.runId,
        expect: (expectationName, expectationOptions) => {
          const reference: ExpectationReference = {
            version: 1,
            workflow:
              source === "browser" && !name.startsWith("browser.")
                ? `browser.${name}`
                : name,
            runId: handle.runId,
            expectationId: expectationOptions?.id ?? "",
          }
          if (shutdownResult) {
            console.warn(
              "[Flowmark] Ignored expectation declaration after client shutdown",
            )
            return reference
          }
          if (source === "proxy") {
            runMarker(
              queue.diagnose(
                new FlowmarkExpectationError({ reason: "source-forbidden" }),
                {
                  type: "expectation_declared",
                  workflow: name,
                  runId: handle.runId,
                  timestamp: new Date().toISOString(),
                  expectationId: expectationOptions?.id ?? "",
                  name: expectationName,
                  withinMs: 0,
                },
              ),
            )
          } else {
            runtime.runSync(
              handle.expect(expectationName, expectationOptions).pipe(
                Effect.catchCause(() =>
                  queue.diagnose(
                    new FlowmarkExpectationError({ reason: "invalid-input" }),
                    {
                      type: "expectation_declared",
                      workflow: name,
                      runId: handle.runId,
                      timestamp: new Date().toISOString(),
                      expectationId: reference.expectationId,
                      name: expectationName,
                      withinMs: 0,
                    },
                  ),
                ),
              ),
            )
          }
          return reference
        },
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
