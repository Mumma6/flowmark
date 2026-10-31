import { Effect, Layer } from "effect"
import { describe, expect, expectTypeOf, it, vi } from "vitest"
import type { WorkflowEvent, WorkflowFailure } from "@flowmarkdev/core"
import { makeClient } from "../src/client/runtime.js"
import { WorkflowTransport } from "../src/delivery/ports/workflow-transport.js"
import { workflow, type OperationErrorMapper } from "../src/index.js"

function setup() {
  const events: WorkflowEvent[] = []
  const diagnostic = vi.fn()
  const client = makeClient(
    Layer.succeed(WorkflowTransport, {
      emit: (event) =>
        Effect.sync(() => {
          events.push(event)
        }),
    }),
    diagnostic,
  )
  return { client, events, diagnostic }
}
describe("per-operation safe callback failure mapping", () => {
  it.each(["sync", "promise", "thenable"])(
    "preserves original %s rejection while emitting only selected fields",
    async (kind) => {
      const { client, events } = setup()
      const original = new Error("SYNTHETIC_SECRET_008")
      const flow = client.workflow("crm.import")
      const callback = () => {
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
      }
      await expect(
        flow.operation("crm-request", callback, {
          mapError: (cause) => {
            expect(cause).toBe(original)
            return {
              code: "CRM_UNAVAILABLE",
              message: "CRM unavailable",
              retryable: true,
              secret: "SYNTHETIC_SECRET_008",
            }
          },
        }),
      ).rejects.toBe(original)
      flow.done({ result: { imported: 0 } })
      await client.shutdown()
      const failure = events.find((event) => event.type === "operation_failed")
      expect(failure).toMatchObject({
        failure: {
          code: "CRM_UNAVAILABLE",
          message: "CRM unavailable",
          retryable: true,
        },
      })
      expect(JSON.stringify(events)).not.toContain("SYNTHETIC_SECRET_008")
      expect(events.at(-1)?.type).toBe("completed")
    },
  )

  it.each([42, null, { code: "DOMAIN", message: "sensitive" }])(
    "maps non-Error/structured causes without changing their identity",
    async (cause) => {
      const { client, events } = setup()
      const flow = client.workflow("structured")
      await expect(
        flow.operation("request", () => Promise.reject(cause), {
          mapError: () => ({ code: "SAFE" }),
        }),
      ).rejects.toBe(cause)
      flow.done()
      await client.shutdown()
      expect(
        events.find((event) => event.type === "operation_failed"),
      ).toMatchObject({ failure: { code: "SAFE" } })
    },
  )

  it.each(["throws", "invalid"])(
    "contains a mapper that %s and rejects only the explicit drain",
    async (kind) => {
      const { client, events, diagnostic } = setup()
      const original = new Error("SYNTHETIC_SECRET_008")
      const mapper = (() => {
        if (kind === "throws") {
          throw new Error("MAPPER_SECRET_008")
        }
        return { code: "", message: "MAPPER_SECRET_008" }
      }) as OperationErrorMapper
      const flow = client.workflow("mapper-failure")
      await expect(
        flow.operation("request", () => Promise.reject(original), {
          mapError: mapper,
        }),
      ).rejects.toBe(original)
      flow.done()
      await expect(client.flush()).rejects.toMatchObject({
        failureCount: 1,
        failures: [
          {
            _tag: "FlowmarkErrorMappingError",
            reason: kind === "throws" ? "threw" : "invalid",
          },
        ],
      })
      expect(diagnostic).toHaveBeenCalledOnce()
      expect(JSON.stringify(diagnostic.mock.calls)).not.toContain("SECRET_008")
      expect(JSON.stringify(events)).not.toContain("SECRET_008")
      expect(
        events.find((event) => event.type === "operation_failed"),
      ).toMatchObject({ failure: { code: "operation_failed" } })
      expect(client.deliveryHealth().failed).toBe(1)
      await client.shutdown()
    },
  )

  it.each([null, false, 0, "not-a-function"])(
    "does not fall back to raw conversion for an invalid configured mapper %j",
    async (mapper) => {
      const { client, events } = setup()
      const flow = client.workflow("invalid-configured-mapper")
      const original = new Error("INVALID_MAPPER_SECRET_008")
      await expect(
        flow.operation("request", () => Promise.reject(original), {
          mapError: mapper as unknown as OperationErrorMapper,
        }),
      ).rejects.toBe(original)
      flow.done()
      await expect(client.shutdown()).rejects.toMatchObject({ failureCount: 1 })
      expect(JSON.stringify(events)).not.toContain("INVALID_MAPPER_SECRET_008")
    },
  )

  it("contains async mapper rejections and throwing option getters", async () => {
    for (const options of [
      {
        mapError: (() =>
          Promise.reject(
            new Error("ASYNC_MAPPER_SECRET"),
          )) as unknown as OperationErrorMapper,
      },
      {
        get mapError(): OperationErrorMapper {
          throw new Error("GETTER_MAPPER_SECRET")
        },
      },
    ]) {
      const { client, events, diagnostic } = setup()
      const original = new Error("APPLICATION_SECRET")
      const flow = client.workflow("invalid-mapper-shape")
      await expect(
        flow.operation("request", () => Promise.reject(original), options),
      ).rejects.toBe(original)
      flow.done()
      await expect(client.shutdown()).rejects.toMatchObject({ failureCount: 1 })
      expect(JSON.stringify(events)).not.toContain("SECRET")
      expect(JSON.stringify(diagnostic.mock.calls)).not.toContain("SECRET")
    }
  })

  it("snapshots mapped fields once before validation and never rereads getters", async () => {
    const { client, events, diagnostic } = setup()
    const flow = client.workflow("mapped-getter")
    let reads = 0
    const cause = new Error("RAW_SECRET")
    await expect(
      flow.operation("request", () => Promise.reject(cause), {
        mapError: () => ({
          code: "SAFE",
          get message() {
            reads++
            if (reads > 1) {
              throw new Error("GETTER_SECRET")
            }
            return "Selected safe message"
          },
        }),
      }),
    ).rejects.toBe(cause)
    flow.done()
    await client.shutdown()
    expect(reads).toBe(1)
    expect(diagnostic).not.toHaveBeenCalled()
    expect(
      events.find((event) => event.type === "operation_failed"),
    ).toMatchObject({
      failure: { code: "SAFE", message: "Selected safe message" },
    })
  })

  it("preserves default conversion, success inference and manual failure semantics", async () => {
    const { client, events } = setup()
    const flow = client.workflow("compatibility")
    const success = flow.operation(
      "success",
      () => Promise.resolve({ saved: 1 }),
      { mapError: () => ({ code: "UNUSED" }) },
    )
    expectTypeOf(success).toEqualTypeOf<Promise<{ saved: number }>>()
    expectTypeOf<OperationErrorMapper>().returns.toEqualTypeOf<WorkflowFailure>()
    await expect(success).resolves.toEqual({ saved: 1 })
    await expect(
      flow.operation("default", () =>
        Promise.reject(new Error("original default message")),
      ),
    ).rejects.toBeInstanceOf(Error)
    const mapper = vi.fn(() => ({ code: "UNUSED" }))
    flow
      .operation("manual", { mapError: mapper })
      .fail({ code: "MANUAL", message: "Selected manually" })
    flow.done()
    await client.shutdown()
    expect(mapper).not.toHaveBeenCalled()
    expect(JSON.stringify(events)).toContain("original default message")
    expect(JSON.stringify(events)).toContain("MANUAL")
  })

  it("preserves opaque callback rejections after an advanced run has already ended", async () => {
    const events: WorkflowEvent[] = []
    const flow = workflow("already-ended", {
      id: "ended-008",
      transport: {
        emit: (event) =>
          Effect.sync(() => {
            events.push(event)
          }),
      },
    })
    flow.done()
    const original = new Error("APPLICATION_SECRET")
    Object.defineProperty(original, "code", {
      get: () => {
        throw new Error("GETTER_SECRET")
      },
    })
    const mapper = vi.fn(() => ({ code: "UNUSED" }))
    await expect(
      flow.operation("ignored-telemetry", () => Promise.reject(original), {
        mapError: mapper,
      }),
    ).rejects.toBe(original)
    await vi.waitFor(() => expect(events.at(-1)?.type).toBe("completed"))
    expect(mapper).not.toHaveBeenCalled()
    expect(events.map((event) => event.type)).toEqual(["started", "completed"])
  })

  it("shares safe mapping and diagnostics with the advanced custom transport boundary", async () => {
    const events: WorkflowEvent[] = []
    const diagnostic = vi.fn()
    const flow = workflow("advanced", {
      id: "advanced-008",
      transport: {
        emit: (event) =>
          Effect.sync(() => {
            events.push(event)
          }),
      },
      onInstrumentationError: diagnostic,
    })
    const cause = new Error("ADVANCED_SECRET_008")
    await expect(
      flow.operation("mapped", () => Promise.reject(cause), {
        mapError: () => ({ code: "SAFE_ADVANCED" }),
      }),
    ).rejects.toBe(cause)
    flow.done()
    await vi.waitFor(() => expect(events.at(-1)?.type).toBe("completed"))
    expect(JSON.stringify(events)).not.toContain("ADVANCED_SECRET_008")
    expect(diagnostic).not.toHaveBeenCalled()
  })
})
