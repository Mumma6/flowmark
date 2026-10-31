import assert from "node:assert/strict"
import { createFlowmark } from "../dist/index.js"

const { FLOWMARK_API_URL: apiUrl, FLOWMARK_API_KEY: apiKey } = process.env
assert(
  apiUrl && apiKey,
  "Set a loopback FLOWMARK_API_URL and synthetic project FLOWMARK_API_KEY",
)
assert(
  ["localhost", "127.0.0.1", "[::1]"].includes(new URL(apiUrl).hostname),
  "This example only writes synthetic loopback telemetry",
)
const client = createFlowmark({ apiUrl, apiKey })
const mode = process.argv[2] ?? "declare"
if (mode === "declare") {
  const flow = client.workflow("example.booking.expectations")
  const reference = flow.expect("provider-response", {
    id: crypto.randomUUID(),
    within: "5m",
  })
  // The application's existing submission happens here. Flowmark does not execute it.
  flow.done({ outcome: "submitted", result: { submitted: 1 } })
  await client.shutdown()
  console.log(JSON.stringify(reference)) // Persist/forward this opaque reference explicitly.
} else {
  assert(
    ["resolve", "cancel"].includes(mode),
    "Choose declare, resolve or cancel",
  )
  assert(
    process.env.FLOWMARK_EXPECTATION_REFERENCE,
    "Pass the previously returned JSON reference as FLOWMARK_EXPECTATION_REFERENCE",
  )
  const reference = JSON.parse(process.env.FLOWMARK_EXPECTATION_REFERENCE)
  if (mode === "resolve") {
    // The application has independently validated the provider callback.
    // A negative business response can still arrive on time.
    client.resolveExpectation(reference, {
      outcome: "no-availability",
      result: { reserved: 0 },
    })
  } else {
    client.cancelExpectation(reference, { code: "BOOKING_CANCELLED" })
  }
  await client.shutdown()
  console.log(`Recorded ${mode} evidence without reopening the execution`)
}
