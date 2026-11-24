import { Effect } from "effect"
import { describe, expect, it, vi } from "vitest"
import { MemoryTransport } from "../src/delivery/adapters/memory-transport.js"
import {
  createFlowmarkWithTransport,
  FlowmarkDeliveryError,
} from "../src/index.js"
import type { WorkflowEvent } from "../src/index.js"

const probe = {
  bindingId: "00000000-0000-4000-8000-000000000003",
  deploymentId: "release-1",
  artifactDigest: "sha256:" + "ab".repeat(32),
  probeId: "checkout.place",
}

const observations = (events: readonly WorkflowEvent[]) =>
  events.filter(
    (event) => event.type === "step" && event.step === "runtime.observation",
  )

describe("deployment binding", () => {
  it("emits one bound observation and leaves properties and references out", async () => {
    const transport = new MemoryTransport()
    const client = createFlowmarkWithTransport({
      transport,
      deployment: probe,
    })
    await expect(
      client.workflow("checkout.place", async () => "paid", {
        properties: { card: "4111" },
      }),
    ).resolves.toBe("paid")
    await client.shutdown()
    const bound = observations(transport.events)
    expect(bound).toHaveLength(1)
    expect(bound[0]).toMatchObject({
      observation: { kind: "observation", references: [], probe },
    })
    expect(bound[0]).not.toHaveProperty("properties")
    expect(JSON.stringify(bound[0])).not.toContain("4111")
  })

  it("emits nothing when deployment configuration is absent, disabled or partial", async () => {
    const absent = new MemoryTransport()
    const disabled = new MemoryTransport()
    const partial = new MemoryTransport()
    const clients = [
      createFlowmarkWithTransport({ transport: absent }),
      createFlowmarkWithTransport({
        transport: disabled,
        deployment: { ...probe, enabled: false },
      }),
      createFlowmarkWithTransport({
        transport: partial,
        deployment: { ...probe, artifactDigest: undefined },
      }),
    ]
    await expect(
      clients[0]?.workflow("checkout.place", async () => "paid"),
    ).resolves.toBe("paid")
    await expect(
      clients[1]?.workflow("checkout.place", async () => "paid"),
    ).resolves.toBe("paid")
    await expect(
      clients[2]?.workflow("checkout.place", async () => "paid"),
    ).resolves.toBe("paid")
    await Promise.all(clients.map((client) => client?.shutdown()))
    expect(observations(absent.events)).toHaveLength(0)
    expect(observations(disabled.events)).toHaveLength(0)
    expect(observations(partial.events)).toHaveLength(0)
  })

  it("preserves the application result when delivery fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const client = createFlowmarkWithTransport({
      transport: { emit: () => Effect.fail(new Error("delivery failed")) },
      deployment: probe,
    })
    await expect(
      client.workflow("checkout.place", async () => "paid"),
    ).resolves.toBe("paid")
    await expect(client.shutdown()).rejects.toBeInstanceOf(
      FlowmarkDeliveryError,
    )
    warn.mockRestore()
  })
})
