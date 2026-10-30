import { FetchHttpClient } from "@effect/platform"
import { Layer } from "effect"
import { HttpTransportLive } from "../features/delivery/adapters/http.js"
import { FlowmarkSettings, resolveSettings } from "../config/settings.js"
import { FlowmarkConfigError } from "../errors/index.js"
import { makeClient } from "./runtime.js"
import { WorkflowTransport } from "../features/delivery/ports/workflow-transport.js"
import type {
  Flow,
  FlowmarkClient,
  FlowmarkConfig,
  WorkflowOperation,
  WorkflowOperationOptions,
  WorkflowOptions,
} from "../types/index.js"
import { withOperationCallback } from "../utils/operation-callback.js"
import { splitOperationArgs } from "../utils/operation-args.js"
import type {
  WorkflowName,
  WorkflowProgress,
  WorkflowStepName,
} from "@flowmarkdev/core"

/**
 * Node server client. Import this from `@flowmarkdev/node` in workers and scripts.
 * Next.js Route Handlers must import createFlowmark from `@flowmarkdev/node/next`.
 * Browser code must import it from `@flowmarkdev/node/browser`.
 * Reads FLOWMARK_API_KEY and FLOWMARK_API_URL; never put those in NEXT_PUBLIC_*.
 * Call shutdown() before process exit. Create one shared client.
 * @throws FlowmarkConfigError If credentials or API origin are invalid.
 */
export function createFlowmark(config: FlowmarkConfig = {}): FlowmarkClient {
  const settings = resolveSettings(config)
  const transport = HttpTransportLive.pipe(
    Layer.provide(Layer.succeed(FlowmarkSettings, settings)),
    Layer.provide(FetchHttpClient.layer),
  )
  return makeClient(transport, config.onInstrumentationError, {
    environment: config.environment,
    release: config.release,
  })
}

/**
 * Advanced entry point for a custom Effect transport, primarily tests and custom integrations.
 * Use createFlowmark().workflow() for ordinary application code.
 * Delivery resources are drained and released after terminal completion. If
 * operations are open, done() waits for their handles to close first.
 * @param name Stable workflow name.
 * @param options Explicit execution ID, transport, and optional diagnostics/metadata.
 * @throws FlowmarkConfigError If no transport is supplied.
 */
export function workflow(name: WorkflowName, options: WorkflowOptions): Flow {
  if (!options.transport) {
    throw new FlowmarkConfigError({
      cause:
        "Use createFlowmark().workflow() for automatic delivery. The low-level workflow() entry point requires a custom transport.",
    })
  }
  const client = makeClient(
    Layer.succeed(WorkflowTransport, options.transport),
    options.onInstrumentationError,
  )
  const flow = client.workflow(name, options)
  let finished = false
  let completionRequested = false
  const activeOperations = new Set<string>()
  const finish = (command: () => void) => {
    if (finished) {
      return
    }
    finished = true
    command()
    void client.shutdown().catch(() => {
      console.warn(
        "[Flowmark] Custom transport workflow completed with delivery failures",
      )
    })
  }
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
    if (finished || completionRequested) {
      const ignored: WorkflowOperation = {
        operationId: globalThis.crypto.randomUUID(),
        done: () => undefined,
        fail: () => undefined,
      }
      return args.callback === undefined
        ? ignored
        : withOperationCallback(ignored, args.callback)
    }
    const handle = flow.operation(name, args.options)
    activeOperations.add(handle.operationId)
    let closed = false
    const operationHandle: WorkflowOperation = {
      operationId: handle.operationId,
      done: () => {
        if (finished || closed) {
          return
        }
        closed = true
        activeOperations.delete(handle.operationId)
        handle.done()
        if (completionRequested && activeOperations.size === 0) {
          finish(() => undefined)
        }
      },
      fail: (failure) => {
        if (finished || closed) {
          return
        }
        closed = true
        activeOperations.delete(handle.operationId)
        handle.fail(failure)
        if (completionRequested && activeOperations.size === 0) {
          finish(() => undefined)
        }
      },
    }
    return args.callback === undefined
      ? operationHandle
      : withOperationCallback(operationHandle, args.callback)
  }
  return {
    runId: flow.runId,
    step(name, stepOptions) {
      if (!finished && !completionRequested) {
        flow.step(name, stepOptions)
      }
    },
    done: (options) => {
      if (finished || completionRequested) {
        return
      }
      if (activeOperations.size > 0) {
        completionRequested = true
        flow.done(options)
        return
      }
      finish(() => flow.done(options))
    },
    fail: (options) => finish(() => flow.fail(options)),
    error: (error) => {
      if (!finished && !completionRequested) {
        flow.error(error)
      }
    },
    setProperties: (properties) => {
      if (!finished && !completionRequested) {
        flow.setProperties(properties)
      }
    },
    report: (snapshot) => {
      if (!finished && !completionRequested) {
        flow.report(snapshot)
      }
    },
    operation,
    progress: (progress: WorkflowProgress) => {
      if (!finished && !completionRequested) {
        flow.progress(progress)
      }
    },
  }
}
