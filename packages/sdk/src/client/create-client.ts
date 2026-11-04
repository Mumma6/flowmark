import { fetchClientLayer } from "../delivery/adapters/fetch-client.js"
import { Layer } from "effect"
import { HttpTransportLive } from "../delivery/adapters/http.js"
import { FlowmarkSettings, resolveSettings } from "../config/settings.js"
import { FlowmarkConfigError } from "../errors/index.js"
import { makeClient } from "./runtime.js"
import { WorkflowTransport } from "../delivery/ports/workflow-transport.js"
import type {
  Flow,
  FlowmarkClient,
  FlowmarkConfig,
  WorkflowOptions,
} from "../types/index.js"
import type { WorkflowName } from "@flowmarkdev/core"

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
    Layer.provide(fetchClientLayer()),
  )
  return makeClient(
    transport,
    config.onInstrumentationError,
    {
      environment: config.environment,
      release: config.release,
    },
    config.delivery,
  )
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
  const lifecycle: { client?: FlowmarkClient } = {}
  lifecycle.client = makeClient(
    Layer.succeed(WorkflowTransport, options.transport),
    options.onInstrumentationError,
    {},
    options.delivery,
    "server",
    () => {
      void lifecycle.client?.shutdown().catch(() => {
        console.warn(
          "[Flowmark] Custom transport workflow completed with delivery failures",
        )
      })
    },
  )
  return lifecycle.client.workflow(name, options)
}

/** Advanced shared lifecycle for custom transports, including settlement-only reporting. */
export function createFlowmarkWithTransport(config: {
  readonly transport: WorkflowTransport
  readonly onInstrumentationError?: import("../types/index.js").InstrumentationErrorHandler
  readonly delivery?: import("../types/index.js").DeliveryOptions
}): FlowmarkClient {
  return makeClient(
    Layer.succeed(WorkflowTransport, config.transport),
    config.onInstrumentationError,
    {},
    config.delivery,
  )
}
