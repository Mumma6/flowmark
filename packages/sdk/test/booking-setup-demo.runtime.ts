import assert from "node:assert/strict"
import { setTimeout as delay } from "node:timers/promises"
import type { WorkflowEvent } from "@flowmarkdev/core"
import {
  createFlowmark,
  createFlowmarkWithTransport,
  MemoryTransport,
  type FlowmarkClient,
} from "../src/index.js"
import {
  recordProviderResponseWithClient,
  submitBookingWithClient,
  withdrawBookingWithClient,
} from "../../../examples/booking-setup-scenarios.js"

async function waitForEvents(
  transport: MemoryTransport,
  minimum: number,
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (transport.events.length >= minimum) {
      return
    }
    await delay(10)
  }
  assert.fail(
    `Expected at least ${minimum} events, got ${transport.events.length}`,
  )
}

async function runMissingTerminal(client: FlowmarkClient): Promise<string> {
  const flow = client.workflow("booking.create", {
    properties: { bookingRef: "synthetic-awaiting", synthetic: true },
  })
  flow.step("awaiting-confirmation")
  await client.flush()
  return flow.runId
}

export async function runBookingSetupDemo(options?: {
  readonly deliver?: boolean
  readonly apiUrl?: string
  readonly apiKey?: string
}) {
  const submitOk = async () => undefined
  const transport = new MemoryTransport()
  const client = createFlowmarkWithTransport({ transport })

  const confirmed = await submitBookingWithClient(
    client,
    { bookingRef: "demo-confirmed", confirmationId: "conf-1" },
    submitOk,
  )
  recordProviderResponseWithClient(client, confirmed, 2)
  await client.flush()
  await waitForEvents(transport, 3)

  const partialMemory = new MemoryTransport()
  const partial = createFlowmarkWithTransport({ transport: partialMemory })
  const partialRef = await submitBookingWithClient(
    partial,
    { bookingRef: "demo-partial", confirmationId: "conf-2" },
    submitOk,
  )
  recordProviderResponseWithClient(partial, partialRef, 0)
  await partial.flush()
  await waitForEvents(partialMemory, 3)

  const withdrawMemory = new MemoryTransport()
  const withdrawClient = createFlowmarkWithTransport({
    transport: withdrawMemory,
  })
  const withdrawnRef = await submitBookingWithClient(
    withdrawClient,
    { bookingRef: "demo-withdrawn", confirmationId: "conf-3" },
    submitOk,
  )
  withdrawBookingWithClient(withdrawClient, withdrawnRef)
  await withdrawClient.flush()
  await waitForEvents(withdrawMemory, 3)

  const openMemory = new MemoryTransport()
  const openClient = createFlowmarkWithTransport({ transport: openMemory })
  const awaitingRunId = await runMissingTerminal(openClient)
  await waitForEvents(openMemory, 2)

  const failMemory = new MemoryTransport()
  const failClient = createFlowmarkWithTransport({ transport: failMemory })
  await assert.rejects(
    () =>
      submitBookingWithClient(
        failClient,
        { bookingRef: "demo-failed", confirmationId: "conf-4" },
        async () => {
          throw new Error("provider-down")
        },
      ),
    /provider-down/,
  )
  await failClient.flush()
  await waitForEvents(failMemory, 2)

  const isTerminal = (event: WorkflowEvent) =>
    event.type === "completed" || event.type === "failed"
  const partialResolved = partialMemory.events.find(
    (
      event,
    ): event is Extract<WorkflowEvent, { type: "expectation_resolved" }> =>
      event.type === "expectation_resolved",
  )
  const summary = {
    mode: "memory" as const,
    confirmedRunEvents: transport.events.length,
    partialOutcome: partialResolved?.outcome,
    withdrawnRunEvents: withdrawMemory.events.length,
    awaitingRunId,
    awaitingTerminal: openMemory.events.some(isTerminal),
    failedRunEvents: failMemory.events.filter(
      (event) => event.type === "failed",
    ).length,
  }

  assert.equal(summary.awaitingTerminal, false)
  assert.equal(summary.partialOutcome, "no-availability")
  assert.ok(summary.confirmedRunEvents >= 3)
  assert.equal(summary.failedRunEvents, 1)

  await client.shutdown()
  await partial.shutdown()
  await withdrawClient.shutdown()
  await openClient.shutdown()
  await failClient.shutdown()

  if (!options?.deliver) {
    return summary
  }

  assert.ok(options.apiKey, "FLOWMARK_API_KEY required for delivery mode")
  const origin = new URL(options.apiUrl ?? "http://127.0.0.1:3103")
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname),
    "Delivery mode requires loopback API",
  )
  const live = createFlowmark({
    apiUrl: origin.toString(),
    apiKey: options.apiKey,
    environment: "local-test",
    release: "booking-setup-demo",
  })
  const liveRef = await submitBookingWithClient(
    live,
    { bookingRef: "demo-live", confirmationId: "conf-live" },
    submitOk,
  )
  recordProviderResponseWithClient(live, liveRef, 1)
  await live.shutdown()
  return {
    ...summary,
    mode: "memory+loopback" as const,
    liveRunId: liveRef.runId,
  }
}
