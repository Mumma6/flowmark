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
  WorkflowOptions,
} from "../types/index.js"
import { withOperationCallback } from "../utils/operation-callback.js"
import type {
  WorkflowName,
  WorkflowProgress,
  WorkflowStepName,
} from "@flowmark/core"

/**
 * Creates a server-side Node.js client using explicit options or FLOWMARK_* environment variables.
 * No specially named configuration file is required; export the instance from any server module.
 * Drain with shutdown() before process exit, or use @flowmark/node/next for automatic request lifetime.
 * For React/browser code, import createFlowmark from @flowmark/node/browser instead.
 * @throws FlowmarkConfigError If credentials or API origin are invalid.
 * @example
 * const flowmark = createFlowmark()
 * const flow = flowmark.workflow("checkout")
 * flow.done()
 * await flowmark.shutdown()
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
  function operation(name: WorkflowStepName): WorkflowOperation
  function operation<T>(
    name: WorkflowStepName,
    callback: () => PromiseLike<T>,
  ): Promise<T>
  function operation<T>(
    name: WorkflowStepName,
    callback?: () => PromiseLike<T>,
  ): WorkflowOperation | Promise<T> {
    if (finished || completionRequested) {
      const ignored: WorkflowOperation = {
        operationId: globalThis.crypto.randomUUID(),
        done: () => undefined,
        fail: () => undefined,
      }
      return callback === undefined
        ? ignored
        : withOperationCallback(ignored, callback)
    }
    const handle = flow.operation(name)
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
      fail: (reason) => {
        if (finished || closed) {
          return
        }
        closed = true
        activeOperations.delete(handle.operationId)
        handle.fail(reason)
        if (completionRequested && activeOperations.size === 0) {
          finish(() => undefined)
        }
      },
    }
    return callback === undefined
      ? operationHandle
      : withOperationCallback(operationHandle, callback)
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
    fail: (reason) => finish(() => flow.fail(reason)),
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
    operation,
    progress: (progress: WorkflowProgress) => {
      if (!finished && !completionRequested) {
        flow.progress(progress)
      }
    },
  }
}
