import assert from "node:assert/strict"
import { createFlowmark } from "../dist/index.js"

const apiUrl = process.env.FLOWMARK_API_URL
const apiKey = process.env.FLOWMARK_API_KEY
assert(
  apiUrl && apiKey,
  "Set FLOWMARK_API_URL and FLOWMARK_API_KEY for an isolated local project",
)
assert(
  ["localhost", "127.0.0.1", "[::1]"].includes(new URL(apiUrl).hostname),
  "This synthetic example only writes to a loopback API",
)
const client = createFlowmark({ apiUrl, apiKey })

// The application owns each attempt and decides whether to try again.
const crm = client.workflow("example.crm-recovery")
const first = crm.operation("push-to-crm", {
  attempt: { groupId: "synthetic-batch", number: 1 },
})
first.fail({ code: "CRM_UNAVAILABLE", retryable: true })
const saved = await crm.operation("push-to-crm", () => Promise.resolve(3), {
  attempt: { groupId: "synthetic-batch", number: 2 },
})
assert.equal(saved, 3)
crm.done({ outcome: "complete", result: { imported: 3 } })

// A separate execution processes only the remaining booking. These results
// are reported work per execution, not deduplicated business-entity totals.
const booking = client.workflow("example.booking")
booking.fail({
  code: "CONFIRMATION_UNAVAILABLE",
  outcome: "partial",
  result: { confirmed: 2, remaining: 1 },
})
const recovery = client.workflow("example.booking", {
  retryOf: { workflow: "example.booking", runId: booking.runId },
})
await recovery.operation(
  "confirm-remaining",
  () => Promise.resolve("confirmed"),
  { attempt: { groupId: "remaining-reservation", number: 1 } },
)
recovery.done({ outcome: "complete", result: { confirmed: 1, remaining: 0 } })
await client.shutdown()
console.log({
  crmRunId: crm.runId,
  previousBookingRunId: booking.runId,
  recoveryRunId: recovery.runId,
})
