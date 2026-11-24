import { Effect } from "effect"
import { describe, expect, expectTypeOf, it, vi } from "vitest"
import {
  createFlowmarkWithTransport,
  FlowmarkDeliveryError,
  MemoryTransport,
  type Flow,
  type FlowmarkClient,
} from "../src/index.js"

describe("single-invocation workflow callbacks", () => {
  it("preserves synchronous values and completes without a terminal wrapper", async () => {
    const transport = new MemoryTransport()
    const client = createFlowmarkWithTransport({ transport })
    const result = client.workflow(
      "briefing.generate",
      (flow) => {
        flow.step("selected")
        return { stories: 3 }
      },
      { properties: { jobId: "daily" } },
    )
    expectTypeOf(result).toEqualTypeOf<Promise<{ stories: number }>>()
    expectTypeOf<ReturnType<FlowmarkClient["workflow"]>>().toEqualTypeOf<Flow>()
    await expect(result).resolves.toEqual({ stories: 3 })
    await client.shutdown()
    expect(transport.events.map((event) => event.type)).toEqual([
      "started",
      "step",
      "completed",
    ])
    expect(transport.events[0]).toMatchObject({
      properties: { jobId: "daily" },
    })
    expect(transport.events.at(-1)).not.toHaveProperty("outcome")
  })

  it("records one explicit partial outcome and preserves the business return", async () => {
    const transport = new MemoryTransport()
    const client = createFlowmarkWithTransport({ transport })
    const returned = { stories: 8, rejected: 2 }
    await expect(
      client.workflow("briefing.generate", async (flow) => {
        const result = await flow.operation("publish", () => returned)
        flow.done({ outcome: "partial", result })
        return result
      }),
    ).resolves.toBe(returned)
    await client.shutdown()
    expect(
      transport.events.filter((event) => event.type === "completed"),
    ).toEqual([
      expect.objectContaining({ outcome: "partial", result: returned }),
    ])
  })

  it.each(["sync", "promise", "thenable"])(
    "records a safe terminal failure and preserves an opaque %s rejection",
    async (kind) => {
      const transport = new MemoryTransport()
      const client = createFlowmarkWithTransport({ transport })
      const read = vi.fn(() => {
        throw new Error("PRIVATE_GETTER")
      })
      const original = Object.create(null, {
        message: { get: read },
        code: { get: read },
      })
      await expect(
        client.workflow("briefing.generate", () => {
          if (kind === "sync") {
            throw original
          }
          if (kind === "thenable") {
            return {
              then: (_resolve: unknown, reject: (cause: unknown) => void) =>
                reject(original),
            } as PromiseLike<never>
          }
          return Promise.reject(original)
        }),
      ).rejects.toBe(original)
      await client.shutdown()
      expect(transport.events.map((event) => event.type)).toEqual([
        "started",
        "failed",
      ])
      expect(transport.events.at(-1)).toMatchObject({
        failure: { code: "workflow_failed" },
      })
      expect(read).not.toHaveBeenCalled()
    },
  )

  it("retains an application-selected failure and its partial result", async () => {
    const transport = new MemoryTransport()
    const client = createFlowmarkWithTransport({ transport })
    const original = new Error("PRIVATE_PROVIDER_DETAIL")
    await expect(
      client.workflow("briefing.generate", (flow) => {
        flow.fail({
          code: "PUBLISH_FAILED",
          outcome: "partial",
          result: { stories: 8 },
        })
        throw original
      }),
    ).rejects.toBe(original)
    await client.shutdown()
    expect(transport.events.filter((event) => event.type === "failed")).toEqual(
      [
        expect.objectContaining({
          failure: { code: "PUBLISH_FAILED" },
          outcome: "partial",
          result: { stories: 8 },
        }),
      ],
    )
    expect(JSON.stringify(transport.events)).not.toContain(
      "PRIVATE_PROVIDER_DETAIL",
    )
  })

  it("lets rejection supersede pending completion while an operation is open", async () => {
    const transport = new MemoryTransport()
    const client = createFlowmarkWithTransport({ transport })
    const original = new Error("business failure")
    await expect(
      client.workflow("briefing.generate", (flow) => {
        flow.operation("still-open")
        flow.done({ outcome: "complete" })
        throw original
      }),
    ).rejects.toBe(original)
    await client.shutdown()
    expect(transport.events.map((event) => event.type)).toEqual([
      "started",
      "operation_started",
      "failed",
    ])
  })

  it("requests completion after the callback but waits for already-open operations", async () => {
    const transport = new MemoryTransport()
    const client = createFlowmarkWithTransport({ transport })
    let close = () => {}
    await client.workflow("briefing.generate", (flow) => {
      close = flow.operation("pending").done
    })
    await client.flush()
    expect(transport.events.map((event) => event.type)).toEqual([
      "started",
      "operation_started",
    ])
    close()
    await client.shutdown()
    expect(transport.events.map((event) => event.type)).toEqual([
      "started",
      "operation_started",
      "operation_completed",
      "completed",
    ])
  })

  it("does not turn telemetry delivery errors into callback errors", async () => {
    const client = createFlowmarkWithTransport({
      transport: { emit: () => Effect.fail(new Error("offline")) },
      onInstrumentationError: () => {},
    })
    await expect(client.workflow("briefing.generate", () => 42)).resolves.toBe(
      42,
    )
    await expect(client.shutdown()).rejects.toBeInstanceOf(
      FlowmarkDeliveryError,
    )
  })

  it("retains manual continuation and rejects use after shutdown before invoking application code", async () => {
    const client = createFlowmarkWithTransport({
      transport: new MemoryTransport(),
    })
    const first = client.workflow("booking.create", { id: "execution" })
    const continuation = client.workflow("booking.create", { id: first.runId })
    continuation.done({ outcome: "confirmed" })
    await client.shutdown()
    const callback = vi.fn()
    expect(() => client.workflow("closed", callback)).toThrow()
    expect(callback).not.toHaveBeenCalled()
  })
})
