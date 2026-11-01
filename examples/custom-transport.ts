import {
  createFlowmarkWithTransport,
  MemoryTransport,
  workflow,
  type WorkflowEvent,
  type WorkflowTransport,
} from "@flowmarkdev/node"

/**
 * Custom transports are an extension point. `MemoryTransport` keeps events
 * in memory and does not call the Flowmark API. Ordinary applications use
 * `createFlowmark()` instead.
 */
const transport = new MemoryTransport()
const flowmark = createFlowmarkWithTransport({
  transport,
  delivery: { progress: "all" },
})

export function recordedEvents(): readonly WorkflowEvent[] {
  return transport.events
}

export function recordLocally(orderId: string): number {
  const flow = flowmark.workflow("checkout.shadow", {
    properties: { orderId },
  })
  flow.step("recorded")
  flow.done({ outcome: "complete", result: { orderId } })
  return recordedEvents().length
}

/** The low-level `workflow()` entry requires an id and a transport. */
export function recordOnce(orderId: string): void {
  const isolated: WorkflowTransport = new MemoryTransport()
  const flow = workflow("checkout.shadow", {
    id: crypto.randomUUID(),
    transport: isolated,
    properties: { orderId },
  })
  flow.done({ outcome: "complete", result: { orderId } })
}
