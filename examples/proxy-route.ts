import { createFlowmarkProxy } from "@flowmarkdev/node/next/proxy"

declare function hasSession(request: Request): Promise<boolean>

/**
 * Same-origin proxy for the browser client. The handler adds the server
 * write key. `@flowmarkdev/node/proxy` exports the same function.
 * Expectation events are rejected by the server-key proxy.
 */
export const POST = createFlowmarkProxy({
  apiUrl: "https://api.flowmark.dev",
  authorize: (request) => hasSession(request),
})
