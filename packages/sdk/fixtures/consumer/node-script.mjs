import assert from "node:assert/strict"
import {
  createFlowmark,
  createRuntimeObservationEmitter,
  FlowmarkConfigError,
  FlowmarkDeliveryError,
} from "@flowmarkdev/node"
import { importInvoices, originalFailure } from "./lib/import-invoices.js"

import {
  observationPolicy,
  observationValues,
} from "./lib/runtime-observation.mjs"

const emitter = createRuntimeObservationEmitter(observationPolicy)
const disabledEmitter = createRuntimeObservationEmitter({
  ...observationPolicy,
  enabled: false,
})
const client = createFlowmark()
const rejectedDelivery = process.argv.includes("--reject-delivery")
const first = client.workflow("consumer.script")
await assert.rejects(
  (async () => {
    disabledEmitter.observe(first, observationValues)
    return importInvoices(first, "failure")
  })(),
  (error) => error === originalFailure,
)
const originalValue = { result: "original" }
assert.equal(
  await client.workflow("consumer.disabled-observation", (flow) => {
    disabledEmitter.observe(flow, observationValues)
    disabledEmitter.reportLoss(flow, 1)
    return originalValue
  }),
  originalValue,
)
const retry = client.workflow("consumer.script", {
  retryOf: { workflow: "consumer.script", runId: first.runId },
})
assert.notEqual(retry.runId, first.runId)
emitter.observe(retry, observationValues)
emitter.reportLoss(retry, 1)
assert.deepEqual(await importInvoices(retry, "partial"), {
  imported: 8,
  rejected: 2,
})
if (rejectedDelivery) {
  await assert.rejects(
    client.shutdown(),
    (error) => error instanceof FlowmarkDeliveryError,
  )
  assert.equal(client.deliveryHealth().pending, 0)
  assert.ok(client.deliveryHealth().failed > 0)
} else {
  await client.flush()
  await importInvoices(client.workflow("consumer.script"))
  client.workflow("consumer.open").operation("still-open")
  await client.shutdown()
  await client.shutdown()
  assert.equal(client.deliveryHealth().pending, 0)
  assert.equal(client.deliveryHealth().failed, 0)
}
assert.throws(() => client.workflow("closed"), FlowmarkConfigError)
console.log("node-consumer-ok")
