// Run after `pnpm --filter @flowmarkdev/node... build`:
// node packages/sdk/examples/outcomes.mjs
// Synthetic, in-memory only: no HTTP, database writes or hosted telemetry.
import { workflow, MemoryTransport } from "../dist/index.js"
import assert from "node:assert/strict"
import { setTimeout } from "node:timers/promises"

const transport = new MemoryTransport()
const flow = workflow("customer.import", {
  id: "synthetic-import",
  properties: { synthetic: true, definitionRevision: "import-v1" },
  transport,
})
// Application-owned example work, already completed before reporting.
const result = { imported: 988, skipped: 12, reasons: { duplicate: 12 } }
flow.progress({ completed: 1000, total: 1000, unit: "rows" })
flow.done({ outcome: "partial", result })
// The advanced in-memory adapter delivers asynchronously.
for (let attempt = 0; attempt < 100 && transport.events.length < 3; attempt++) {
  await setTimeout(10)
}
assert.equal(transport.events.length, 3)
assert.equal(transport.events.at(-1).outcome, "partial")
console.log(JSON.stringify(transport.events.at(-1), null, 2))
