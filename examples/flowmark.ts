import { createFlowmark, defineConfig } from "@flowmarkdev/node"

/**
 * Shared Node.js client for workers and long-lived servers.
 * `defineConfig` returns this object unchanged. It does not read the
 * environment or open a connection. Omit `apiKey` and `apiUrl` to use
 * `FLOWMARK_API_KEY` and `FLOWMARK_API_URL`.
 * Call `shutdown()` before the process exits. Next.js Route Handlers
 * should use `@flowmarkdev/node/next` instead.
 */
const config = defineConfig({
  environment: "production",
  onInstrumentationError(error, event) {
    console.error("[Flowmark] Instrumentation event was not delivered", {
      failure: error._tag,
      eventType: event.type,
      workflow: event.workflow,
      runId: event.runId,
    })
  },
})

export const flowmark = createFlowmark(config)
