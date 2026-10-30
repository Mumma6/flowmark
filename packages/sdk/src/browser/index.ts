import { FetchHttpClient } from "@effect/platform"
import { Either, Layer, Redacted, Schema } from "effect"
import { makeHttpTransport } from "../features/delivery/adapters/http-transport.js"
import { FlowmarkConfigError } from "../errors/index.js"
import { makeClient } from "../client/runtime.js"
import { WorkflowTransport } from "../features/delivery/ports/workflow-transport.js"
import type {
  FlowmarkClient,
  InstrumentationErrorHandler,
} from "../types/index.js"
import { ApiOriginSchema } from "../config/api-origin.js"

export type {
  Flow,
  FlowmarkClient,
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
  WorkflowOutcome,
} from "@flowmarkdev/core"

/** Browser options: a public browser key for direct delivery, or a same-origin proxy path. Never include server secrets. */
export interface BrowserFlowmarkConfig {
  /** Same-origin absolute proxy path, default "/api/flowmark". External URLs, queries, and fragments are rejected. */
  readonly proxyPath?: string
  /**
   * Public browser-only project key for direct delivery without your own backend.
   * Never supply a secret server write key. Requires apiUrl; cannot be combined with proxyPath.
   */
  readonly publicKey?: string
  /** Flowmark API origin for direct delivery. Required with publicKey; never an ingestion path. */
  readonly apiUrl?: string
  /** Optional deployment environment sent with each started workflow. */
  readonly environment?: string
  /** Optional release/version sent with each started workflow. */
  readonly release?: string
  /** Receives typed delivery failures. If omitted, warnings are logged without interrupting UI code. */
  readonly onInstrumentationError?: InstrumentationErrorHandler
}

/**
 * Defines browser configuration with autocomplete and preserved literal types.
 * Returns the same object without accessing browser globals or creating a client.
 * Safe during SSR; validation happens when the client starts its first workflow.
 * Export from flowmark.config.ts and pass to createFlowmark(); the file is not auto-loaded.
 * Only public browser keys belong here, never secret server keys.
 * @example
 * export default defineConfig({
 *   publicKey: "fm_browser_...",
 *   apiUrl: "http://localhost:3003",
 * })
 */
export function defineConfig<const T extends BrowserFlowmarkConfig>(
  config: T & Record<Exclude<keyof T, keyof BrowserFlowmarkConfig>, never>,
): T {
  return config
}

/**
 * Creates a browser client. Works in ordinary React/Vite apps as well as Next.js.
 * Pass publicKey and apiUrl to send directly to Flowmark without your own backend.
 * Without these options, uses your same-origin backend proxy at /api/flowmark.
 * Never pass a secret server write key or import `@flowmarkdev/node` / `@flowmarkdev/node/next` here.
 * Safe to create during SSR, but call workflow() only in browser event handlers or effects.
 * Delivery starts automatically and uses keepalive; offline/unload delivery is not guaranteed.
 * No config file, React provider, or Next.js dependency is required.
 * @param config Public browser key/API origin for direct delivery, or a proxy path; optional error callback.
 * @example
 * import { createFlowmark } from "@flowmarkdev/node/browser"
 * const flowmark = createFlowmark({ publicKey: "fm_browser_...", apiUrl: "https://your-flowmark-api" })
 * // Inside a click/submit handler:
 * const flow = flowmark.workflow("checkout.ui")
 * flow.step("form-submitted")
 * flow.done()
 */
export function createFlowmark(
  config: BrowserFlowmarkConfig = {},
): FlowmarkClient {
  let client: FlowmarkClient | undefined
  let closed = false
  const getClient = () => {
    if (closed) {
      throw new FlowmarkConfigError({ cause: "Client has been shut down" })
    }
    if (!client) {
      const location = globalThis.location
      if (!location) {
        throw new FlowmarkConfigError({
          cause:
            "Browser workflows must run in the browser, not during server rendering",
        })
      }
      const direct =
        config.publicKey !== undefined || config.apiUrl !== undefined
      let endpoint: URL
      let publicKey: string | undefined
      if (direct) {
        if (config.proxyPath !== undefined) {
          throw new FlowmarkConfigError({
            cause:
              "Choose either direct browser delivery or proxyPath, not both",
          })
        }
        const settings = Either.match(
          Schema.decodeUnknownEither(
            Schema.Struct({
              publicKey: Schema.NonEmptyString,
              apiUrl: ApiOriginSchema,
            }),
          )({ publicKey: config.publicKey, apiUrl: config.apiUrl }),
          {
            onLeft: (cause) => {
              throw new FlowmarkConfigError({ cause })
            },
            onRight: (value) => value,
          },
        )
        endpoint = new URL("/v1/browser-events", settings.apiUrl)
        publicKey = settings.publicKey
      } else {
        const path = config.proxyPath ?? "/api/flowmark"
        if (
          !path.startsWith("/") ||
          path.startsWith("//") ||
          path.includes("\\") ||
          path.includes("?") ||
          path.includes("#")
        ) {
          throw new FlowmarkConfigError({
            cause: "proxyPath must be a same-origin absolute path",
          })
        }
        endpoint = new URL(path, location.origin)
        if (endpoint.origin !== location.origin) {
          throw new FlowmarkConfigError({
            cause: "Proxy must be on the same origin",
          })
        }
      }
      const http = FetchHttpClient.layer.pipe(
        Layer.provide(
          Layer.succeed(FetchHttpClient.RequestInit, {
            credentials: direct ? "omit" : "same-origin",
            mode: direct ? "cors" : "same-origin",
            keepalive: true,
          }),
        ),
      )
      client = makeClient(
        Layer.effect(
          WorkflowTransport,
          makeHttpTransport({
            endpoint: endpoint.toString(),
            ...(publicKey === undefined
              ? {}
              : { apiKey: Redacted.make(publicKey) }),
          }),
        ).pipe(Layer.provide(http)),
        config.onInstrumentationError,
        { environment: config.environment, release: config.release },
      )
    }
    return client
  }

  return {
    workflow: (name, options) => getClient().workflow(name, options),
    flush: () => client?.flush() ?? Promise.resolve(),
    shutdown() {
      closed = true
      return client?.shutdown() ?? Promise.resolve()
    },
  }
}
