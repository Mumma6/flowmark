// Build the SDK, then run: node packages/sdk/examples/outcomes.mjs
// Synthetic, in-memory only: no HTTP or hosted telemetry.
import { createFlowmarkWithTransport, MemoryTransport } from "../dist/index.js"
import assert from "node:assert/strict"

const transport = new MemoryTransport()
const client = createFlowmarkWithTransport({ transport })
await client.workflow(
  "customer.import",
  (flow) => {
    const result = { imported: 988, skipped: 12, reasons: { duplicate: 12 } }
    flow.progress({ completed: 1000, total: 1000, unit: "rows" })
    flow.done({ outcome: "partial", result })
  },
  { properties: { synthetic: true, definitionRevision: "import-v1" } },
)
await client.shutdown()
assert.equal(transport.events.length, 3)
assert.equal(transport.events.at(-1).outcome, "partial")
console.log(JSON.stringify(transport.events.at(-1), null, 2))
