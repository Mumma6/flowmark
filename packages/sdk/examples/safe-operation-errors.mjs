import assert from "node:assert/strict"
import { createFlowmark } from "../dist/index.js"

const apiUrl = process.env.FLOWMARK_API_URL
const apiKey = process.env.FLOWMARK_API_KEY
if (
  !apiUrl ||
  !apiKey ||
  !["localhost", "127.0.0.1", "[::1]"].includes(new URL(apiUrl).hostname)
) {
  throw new Error(
    "Use an explicit loopback API origin and its local write key for this synthetic example",
  )
}
const client = createFlowmark({ apiUrl, apiKey })
const flow = client.workflow("example.crm-safe-errors")
const result = {
  imported: 2,
  rejected: 1,
  failed: 0,
  reasons: { invalid_email: 1 },
}
// Expected application-owned domain rejections are business evidence.
flow.report(result)
const original = new Error("SYNTHETIC_PROVIDER_TOKEN_008_never_send")
try {
  await flow.operation(
    "crm-request",
    async () => {
      throw original
    },
    {
      mapError: (_cause) => ({
        code: "CRM_UNAVAILABLE",
        message: "CRM temporarily unavailable",
        retryable: true,
      }),
    },
  )
} catch (cause) {
  assert.equal(cause, original)
  // The application deliberately recovers; the SDK never schedules/retries this work.
  result.failed++
}
flow.done({ outcome: "partial", result })
try {
  await client.shutdown()
} catch (error) {
  console.error("Telemetry drain failed", { failureCount: error.failureCount })
}
console.log({ runId: flow.runId, result })
