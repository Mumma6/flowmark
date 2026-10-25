import { after } from "next/server"
import { createFlowmark as createClient } from "../client/create-client.js"
import type { FlowmarkClient, FlowmarkConfig } from "../types/index.js"

export type {
  Flow,
  FlowmarkClient,
  FlowmarkConfig,
  WorkflowDoneOptions,
  WorkflowFailOptions,
  WorkflowOptions,
  WorkflowOperation,
  WorkflowOperationOptions,
  WorkflowRunOptions,
  WorkflowStepOptions,
} from "../types/index.js"
export type {
  JsonValue,
  WorkflowRunId,
  WorkflowError,
  WorkflowCorrelationId,
  WorkflowFailure,
  WorkflowProperties,
  WorkflowProgress,
  WorkflowOperationFailure,
  WorkflowResult,
} from "@flowmark/core"
export { defineConfig } from "../config/define-config.js"

/**
 * Creates a server-side Next.js client that automatically drains each workflow via after().
 * Use inside Route Handlers or Server Actions, not Client Components, middleware, or render.
 * Reads FLOWMARK_API_KEY and FLOWMARK_API_URL unless overridden. No config file is required.
 * Each workflow has its own request-scoped client; delivery errors are logged after the response.
 * @param config Server-only credentials, API origin, and optional error callback.
 * @example
 * import { createFlowmark } from "@flowmark/node/next"
 * const flowmark = createFlowmark()
 * // In a Route Handler or Server Action:
 * const flow = flowmark.workflow("todo.add")
 * flow.done()
 */
export function createFlowmark(
  config: FlowmarkConfig = {},
): Pick<FlowmarkClient, "workflow"> {
  return {
    workflow(name, options) {
      const lifecycle: { client?: FlowmarkClient } = {}
      // Register before starting work so unsupported contexts cannot orphan delivery.
      after(async () => {
        const client = lifecycle.client
        if (!client) {
          return
        }
        try {
          await client.shutdown()
        } catch (cause) {
          console.error(
            "[Flowmark] Workflow delivery failed; application changes are unaffected.",
            cause,
          )
        }
      })
      const client = createClient(config)
      lifecycle.client = client
      return client.workflow(name, options)
    },
  }
}
