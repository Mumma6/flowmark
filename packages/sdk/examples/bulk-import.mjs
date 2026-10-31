import { createFlowmark } from "../dist/index.js"

// Run after building the SDK. Supply a loopback API origin and local write key.
// This example changes no application records and must not target hosted ingestion.
const apiUrl = process.env.FLOWMARK_API_URL
const apiKey = process.env.FLOWMARK_API_KEY
if (
  !apiUrl ||
  !apiKey ||
  !["localhost", "127.0.0.1", "[::1]"].includes(new URL(apiUrl).hostname)
) {
  throw new Error(
    "Set FLOWMARK_API_URL to a loopback API and FLOWMARK_API_KEY to its local write key",
  )
}
const flowmark = createFlowmark({
  apiUrl,
  apiKey,
  delivery: { progress: "latest" },
})
const flow = flowmark.workflow("example.bulk-import")

// Replace this synthetic application-owned work with your own batch processing.
async function processBatch(rows) {
  return rows.length
}

let saved = 0
try {
  for (let offset = 0; offset < 10_000; offset += 100) {
    saved += await processBatch(
      Array.from({ length: 100 }, (_, index) => offset + index),
    )
    flow.progress({ completed: saved, total: 10_000, unit: "records" })
    // Business reports are never coalesced. Record useful milestones, not every row.
    if (saved % 1000 === 0) flow.report({ saved })
  }
  flow.done({ result: { saved } })
} catch (cause) {
  flow.fail({ code: "IMPORT_FAILED", result: { saved } })
  throw cause
} finally {
  // Draining must not replace an application's return value or original rejection.
  try {
    await flowmark.shutdown()
  } catch (error) {
    console.error("Telemetry delivery failed", {
      failureCount: error.failureCount,
    })
  }
  console.log(flowmark.deliveryHealth())
}
