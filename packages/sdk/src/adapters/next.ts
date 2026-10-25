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
 * Next.js server client. Import from `@flowmark/node/next` only.
 * Use in Route Handlers or Server Actions. Not Client Components, middleware, or render.
 * Reads FLOWMARK_API_KEY and FLOWMARK_API_URL. Never NEXT_PUBLIC_*.
 * Drains via after() — do not call shutdown() yourself.
 * One shared module-level client; wrap the places the developer named.
 * @example
 * import { createFlowmark } from "@flowmark/node/next"
 * export const flowmark = createFlowmark()
 * const flow = flowmark.workflow("checkout.order")
 * flow.done({ result: { ok: true } })
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
