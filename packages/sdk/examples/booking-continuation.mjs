// Build with `pnpm --filter @flowmarkdev/node... build`, then run against an
// explicitly configured disposable loopback API. Synthetic telemetry only:
// FLOWMARK_API_URL=http://127.0.0.1:3103 FLOWMARK_API_KEY=<test key> \
//   node packages/sdk/examples/booking-continuation.mjs
import assert from "node:assert/strict"
import { createFlowmark } from "../dist/index.js"

const origin = new URL(process.env.FLOWMARK_API_URL ?? "http://127.0.0.1:3103")
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname),
  "Example requires an isolated loopback API",
)
assert.ok(
  process.env.FLOWMARK_API_KEY,
  "Supply an isolated project's test write key",
)
const config = {
  apiUrl: origin.toString(),
  apiKey: process.env.FLOWMARK_API_KEY,
}

// Request/process one: the application's booking is awaiting confirmation.
const submissionClient = createFlowmark(config)
const submission = submissionClient.workflow("booking.create", {
  properties: { bookingRef: "synthetic-booking-42", synthetic: true },
  environment: "local-test",
  release: "submission",
})
submission.step("awaiting-confirmation")
submission.report({ reserved: 0 })
const reference = { workflow: "booking.create", runId: submission.runId }
await submissionClient.shutdown() // Stored execution remains without a terminal.

// Application-owned payload propagation, illustrated with a JSON round trip.
// Real applications authenticate/validate callbacks and deduplicate business work.
const callbackReference = JSON.parse(JSON.stringify(reference))
const callbackClient = createFlowmark(config)
const callback = callbackClient.workflow(callbackReference.workflow, {
  id: callbackReference.runId,
})
callback.setProperties({ confirmationReceived: true })
callback.done({ outcome: "confirmed", result: { reserved: 1 } })
await callbackClient.shutdown()

// A duplicate callback using a fresh event ID is a conflicting terminal.
const diagnostics = []
const duplicateClient = createFlowmark({
  ...config,
  onInstrumentationError: (error) => diagnostics.push(error),
})
duplicateClient.workflow(reference.workflow, { id: reference.runId }).fail({
  code: "LATE_CALLBACK",
  outcome: "rejected",
  result: { reserved: 0 },
})
await assert.rejects(duplicateClient.flush(), { _tag: "FlowmarkDeliveryError" })
assert.equal(diagnostics.length, 1)
await duplicateClient.shutdown()

// A distinct application attempt gets its own execution ID; no retry is executed.
const attemptClient = createFlowmark(config)
const attempt = attemptClient.workflow(reference.workflow, {
  properties: { bookingRef: "synthetic-booking-42", synthetic: true },
})
assert.notEqual(attempt.runId, reference.runId)
attempt.done({ outcome: "unavailable", result: { reserved: 0 } })
await attemptClient.shutdown()
const awaitingClient = createFlowmark(config)
const awaiting = awaitingClient.workflow(reference.workflow, {
  properties: {
    bookingRef: "synthetic-awaiting-confirmation",
    synthetic: true,
  },
})
awaiting.step("awaiting-confirmation")
await awaitingClient.shutdown() // No terminal: do not infer liveness or failure.
console.log(
  JSON.stringify({
    reference,
    separateAttempt: attempt.runId,
    awaitingConfirmation: awaiting.runId,
  }),
)
