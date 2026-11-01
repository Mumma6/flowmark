import {
  createFlowmark,
  defineConfig,
  FlowmarkConfigError,
  FlowmarkErrorMappingError,
  FlowmarkExpectationError,
  FlowmarkHttpError,
  FlowmarkQueueError,
  WorkflowTransportError,
} from "@flowmarkdev/node"

/**
 * Shared Node.js client for workers and long-lived servers.
 * `defineConfig` returns this object unchanged. It does not read the
 * environment or open a connection. `apiKey` falls back to FLOWMARK_API_KEY.
 * Call `shutdown()` before the process exits. Next.js Route Handlers
 * should use `@flowmarkdev/node/next` instead.
 */
const config = defineConfig({
  apiUrl: "https://api.flowmark.dev",
  environment: "production",
  onInstrumentationError(error, event) {
    const where = {
      eventType: event.type,
      workflow: event.workflow,
      runId: event.runId,
    }
    if (error instanceof FlowmarkQueueError) {
      console.error("[Flowmark] Event was not queued", {
        reason: error.reason,
        ...where,
      })
      return
    }
    if (error instanceof FlowmarkExpectationError) {
      console.error("[Flowmark] Expectation was rejected", {
        reason: error.reason,
        ...where,
      })
      return
    }
    if (error instanceof FlowmarkErrorMappingError) {
      console.error("[Flowmark] mapError was rejected", {
        reason: error.reason,
        ...where,
      })
      return
    }
    if (error instanceof WorkflowTransportError) {
      console.error("[Flowmark] Delivery failed", where)
      return
    }
    console.error("[Flowmark] Event was not accepted", {
      failure: error._tag,
      ...where,
    })
  },
})

export const flowmark = createFlowmark(config)

/** `FlowmarkHttpError` is the HTTP transport failure. `status` is absent for network or timeout failures. */
export function isRetryableHttpFailure(cause: unknown): boolean {
  return cause instanceof FlowmarkHttpError && cause.retryable === true
}

export function clientFromConfig(apiKey: string, apiUrl: string) {
  try {
    return createFlowmark({ apiKey, apiUrl, environment: "production" })
  } catch (cause) {
    if (cause instanceof FlowmarkConfigError) {
      throw new Error(`Flowmark is not configured: ${cause.message}`)
    }
    throw cause
  }
}
