import { createFlowmark, defineConfig } from "@flowmarkdev/node/browser"

/**
 * Browser clients never read FLOWMARK_API_KEY. Call `workflow()` from an
 * event handler or effect, not during render. `flush()` drains before a
 * full-page navigation. `shutdown()` closes the client.
 */
const throughProxy = createFlowmark(
  defineConfig({
    proxyPath: "/api/flowmark",
    environment: "production",
    release: "web-1",
  }),
)

const direct = createFlowmark(
  defineConfig({
    publicKey: "fm_browser_public",
    apiUrl: "https://api.flowmark.dev",
    environment: "production",
    release: "web-1",
  }),
)

export async function submitCheckoutForm(orderId: string): Promise<void> {
  const flow = throughProxy.workflow("checkout.client", {
    properties: { orderId },
  })
  flow.step("form-submitted")
  flow.done({ outcome: "submitted", result: { orderId } })
  await throughProxy.flush()
}

export async function submitDirectCheckout(orderId: string): Promise<void> {
  const flow = direct.workflow("checkout.client", {
    properties: { orderId },
  })
  flow.step("form-submitted")
  flow.done({ outcome: "submitted", result: { orderId } })
  await direct.flush()
}

export async function stopBrowserClients(): Promise<void> {
  await throughProxy.shutdown()
  await direct.shutdown()
}
