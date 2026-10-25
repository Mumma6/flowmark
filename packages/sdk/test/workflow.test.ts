import { Effect } from "effect"
import { describe, expect, it, vi } from "vitest"
import { MemoryTransport, type WorkflowEvent, workflow } from "../src/index.js"

describe("workflow", () => {
  it("records a start, semantic steps, and successful completion", async () => {
    const transport = new MemoryTransport()
    const flow = workflow("checkout", {
      id: "order_123",
      properties: { provider: "stripe" },
      transport,
    })

    expect(flow.runId).toBe("order_123")
    flow.step("payment-created")
    flow.step("order-created")
    flow.done()

    await vi.waitFor(() => expect(transport.events).toHaveLength(4))
    expect(transport.events.map(({ type }) => type)).toEqual([
      "started",
      "step",
      "step",
      "completed",
    ])
    expect(transport.events[0]).toMatchObject({
      type: "started",
      workflow: "checkout",
      runId: "order_123",
      properties: { provider: "stripe" },
    })
    expect(transport.events[1]).toMatchObject({
      type: "step",
      step: "payment-created",
    })
    expect(transport.events[3]).toMatchObject({ type: "completed" })
    expect(
      transport.events.every(({ timestamp }) =>
        Number.isFinite(Date.parse(timestamp)),
      ),
    ).toBe(true)
  })

  it("records explicit correlation metadata and exposes its run ID", async () => {
    const transport = new MemoryTransport()
    const flow = workflow("browser.checkout", {
      id: "child-run",
      correlationId: "request-123",
      parentRunId: "server-run",
      transport,
    })
    expect(flow.runId).toBe("child-run")
    flow.done()
    await vi.waitFor(() => expect(transport.events).toHaveLength(2))
    expect(transport.events[0]).toMatchObject({
      type: "started",
      correlationId: "request-123",
      parentRunId: "server-run",
    })
    const legacy = workflow("legacy.checkout", {
      id: "legacy-run",
      transport: new MemoryTransport(),
    })
    expect(legacy.runId).toBe("legacy-run")
  })

  it("records a controlled failure and ignores events after a terminal event", async () => {
    const transport = new MemoryTransport()
    const flow = workflow("checkout", { id: "order_456", transport })

    flow.fail("payment-declined")
    flow.step("should-not-be-recorded")
    flow.done()

    await vi.waitFor(() => expect(transport.events).toHaveLength(2))
    expect(transport.events.map(({ type }) => type)).toEqual([
      "started",
      "failed",
    ])
    expect(transport.events[1]).toMatchObject({
      type: "failed",
      reason: "payment-declined",
    })
  })

  it("records amended context, recoverable errors and a structured result", async () => {
    const transport = new MemoryTransport()
    const flow = workflow("checkout", {
      id: "order_context",
      environment: "production",
      release: "2026.10.23",
      properties: { orderId: "order_context", region: "eu" },
      transport,
    })

    flow.step("payment-authorized", { properties: { provider: "stripe" } })
    flow.setProperties({ region: "eu-west", attempt: 2 })
    flow.error({
      code: "inventory-retry",
      message: "A retry was scheduled",
      retryable: true,
      handled: true,
    })
    flow.error({ code: "needs-attention", handled: false })
    flow.done({ result: { receiptId: "receipt_123", total: 42 } })
    flow.step("ignored")
    flow.setProperties({ ignored: true })
    flow.error({ code: "ignored", handled: false })
    flow.fail("ignored")

    await vi.waitFor(() => expect(transport.events).toHaveLength(6))
    expect(transport.events.map(({ type }) => type)).toEqual([
      "started",
      "step",
      "properties",
      "error",
      "error",
      "completed",
    ])
    expect(transport.events[0]).toMatchObject({
      type: "started",
      environment: "production",
      release: "2026.10.23",
      properties: { orderId: "order_context", region: "eu" },
    })
    expect(transport.events[1]).toMatchObject({
      type: "step",
      step: "payment-authorized",
      properties: { provider: "stripe" },
    })
    expect(transport.events[2]).toMatchObject({
      type: "properties",
      properties: { region: "eu-west", attempt: 2 },
    })
    expect(transport.events[3]).toMatchObject({
      type: "error",
      error: { code: "inventory-retry", handled: true, retryable: true },
    })
    expect(transport.events[4]).toMatchObject({
      type: "error",
      error: { code: "needs-attention", handled: false },
    })
    expect(transport.events[5]).toMatchObject({
      type: "completed",
      result: { receiptId: "receipt_123", total: 42 },
    })
  })

  it("records object failures and retains the legacy string failure event shape", async () => {
    const structuredTransport = new MemoryTransport()
    const structured = workflow("checkout", {
      id: "order_structured_failure",
      transport: structuredTransport,
    })
    structured.fail({
      code: "payment-declined",
      message: "Payment was declined",
      retryable: false,
    })

    const legacyTransport = new MemoryTransport()
    const legacy = workflow("checkout", {
      id: "order_legacy_failure",
      transport: legacyTransport,
    })
    legacy.fail("payment-declined")

    await vi.waitFor(() => {
      expect(structuredTransport.events).toHaveLength(2)
      expect(legacyTransport.events).toHaveLength(2)
    })
    expect(structuredTransport.events[1]).toMatchObject({
      type: "failed",
      failure: {
        code: "payment-declined",
        message: "Payment was declined",
        retryable: false,
      },
      reason: "Payment was declined",
    })
    expect(legacyTransport.events[1]).toMatchObject({
      type: "failed",
      reason: "payment-declined",
      failure: { code: "payment-declined" },
    })
  })

  it("tracks concurrent operations with unique IDs and monotonic durations", async () => {
    const transport = new MemoryTransport()
    const flow = workflow("checkout", {
      id: "order_operations",
      transport,
    })
    const payment = flow.operation("charge-payment")
    const inventory = flow.operation("reserve-stock")
    expect(payment.operationId).not.toBe(inventory.operationId)
    flow.done({ result: { outcome: "first-request" } })
    flow.done({ result: { outcome: "ignored-second-request" } })
    flow.step("ignored-after-completion-request")
    flow.progress({ completed: 1, total: 2 })
    await expect(
      flow.operation("ignored-after-completion-request", async () => "ok"),
    ).resolves.toBe("ok")
    inventory.fail({ code: "out-of-stock", retryable: false })
    await vi.waitFor(() => expect(transport.events).toHaveLength(4))
    expect(transport.events.some((event) => event.type === "completed")).toBe(
      false,
    )
    payment.done()

    await vi.waitFor(() => expect(transport.events).toHaveLength(6))
    expect(transport.events.map(({ type }) => type)).toEqual([
      "started",
      "operation_started",
      "operation_started",
      "operation_failed",
      "operation_completed",
      "completed",
    ])
    const starts = transport.events.filter(
      (event) => event.type === "operation_started",
    )
    const terminals = transport.events.filter(
      (event) =>
        event.type === "operation_completed" ||
        event.type === "operation_failed",
    )
    expect(new Set(starts.map((event) => event.operationId)).size).toBe(2)
    expect(terminals).toMatchObject([
      {
        type: "operation_failed",
        operationName: "reserve-stock",
        failure: { code: "out-of-stock" },
      },
      { type: "operation_completed", operationName: "charge-payment" },
    ])
    for (const terminal of terminals) {
      if (
        terminal.type === "operation_completed" ||
        terminal.type === "operation_failed"
      ) {
        expect(terminal.durationMs).toBeGreaterThanOrEqual(0)
        expect(Number.isFinite(terminal.durationMs)).toBe(true)
      }
    }
    expect(transport.events.at(-1)).toMatchObject({
      type: "completed",
      result: { outcome: "first-request" },
    })
  })

  it("wraps promise callbacks without replacing results or application errors", async () => {
    const transport = new MemoryTransport()
    const flow = workflow("checkout", { id: "order_operation_callback", transport })
    const result = await flow.operation("load-customer", async () => ({
      customerId: "customer-1",
    }))
    expect(result).toEqual({ customerId: "customer-1" })

    const original = new Error("application callback failed")
    await expect(
      flow.operation("charge-payment", async () => {
        throw original
      }),
    ).rejects.toBe(original)
    flow.done()

    await vi.waitFor(() => expect(transport.events).toHaveLength(6))
    expect(transport.events.map(({ type }) => type)).toEqual([
      "started",
      "operation_started",
      "operation_completed",
      "operation_started",
      "operation_failed",
      "completed",
    ])
    expect(transport.events[4]).toMatchObject({
      type: "operation_failed",
      operationName: "charge-payment",
      failure: { code: "operation_callback_failed" },
    })
    expect(transport.events[5]).toMatchObject({ type: "completed" })
  })

  it("records synchronous callback throws and preserves the original cause", async () => {
    const transport = new MemoryTransport()
    const flow = workflow("checkout", {
      id: "order_sync_operation_callback",
      transport,
    })
    const original = new Error("synchronous callback failure")
    await expect(
      flow.operation("charge-payment", () => {
        throw original
      }),
    ).rejects.toBe(original)
    flow.done()

    await vi.waitFor(() => expect(transport.events).toHaveLength(4))
    expect(transport.events.map(({ type }) => type)).toEqual([
      "started",
      "operation_started",
      "operation_failed",
      "completed",
    ])
    expect(transport.events[2]).toMatchObject({
      type: "operation_failed",
      failure: { code: "operation_callback_failed" },
    })
  })

  it("keeps explicit workflow failure terminal when an operation is still open", async () => {
    const transport = new MemoryTransport()
    const flow = workflow("checkout", {
      id: "order_fail_with_open_operation",
      transport,
    })
    const operation = flow.operation("charge-payment")
    flow.done({ result: { outcome: "must-not-complete" } })
    flow.fail({ code: "checkout-failed" })
    operation.done()

    await vi.waitFor(() => expect(transport.events).toHaveLength(3))
    expect(transport.events.map(({ type }) => type)).toEqual([
      "started",
      "operation_started",
      "failed",
    ])
  })

  it("records absolute progress snapshots and ignores operation/progress after terminal markers", async () => {
    const transport = new MemoryTransport()
    const flow = workflow("import", { id: "run_progress", transport })
    flow.progress({ completed: 0, total: 4, unit: "rows" })
    flow.progress({ completed: 2, total: 4, unit: "rows" })
    flow.done()
    const callback = await flow.operation("after-completion", async () => "result")
    expect(callback).toBe("result")
    flow.progress({ completed: 4, total: 4, unit: "rows" })

    await vi.waitFor(() => expect(transport.events).toHaveLength(4))
    expect(transport.events.map(({ type }) => type)).toEqual([
      "started",
      "progress",
      "progress",
      "completed",
    ])
    expect(transport.events[1]).toMatchObject({
      type: "progress",
      completed: 0,
      total: 4,
      unit: "rows",
    })
    expect(transport.events[2]).toMatchObject({
      type: "progress",
      completed: 2,
      total: 4,
      unit: "rows",
    })
  })

  it("keeps transport failures and diagnostic failures out of application logic", async () => {
    const transport = {
      emit: vi.fn(() => Effect.fail(new Error("transport unavailable"))),
    }
    const onInstrumentationError = vi.fn(
      (error: unknown, event: WorkflowEvent) => {
        expect(error).toBeDefined()
        expect(event.type).toBeDefined()
        throw new Error("diagnostics unavailable")
      },
    )

    expect(() => {
      const flow = workflow("checkout", {
        id: "order_789",
        transport,
        onInstrumentationError,
      })
      flow.step("payment-created")
      flow.done()
    }).not.toThrow()

    await vi.waitFor(() => {
      expect(transport.emit).toHaveBeenCalledTimes(3)
      expect(onInstrumentationError).toHaveBeenCalledTimes(3)
    })
    expect(onInstrumentationError.mock.calls[0]?.[0]).toMatchObject({
      _tag: "WorkflowTransportError",
    })
    expect(onInstrumentationError.mock.calls[0]?.[0]).toHaveProperty("cause")
  })

  it("serializes asynchronous event delivery for each run", async () => {
    const events: WorkflowEvent[] = []
    const transport = {
      emit: (event: WorkflowEvent) =>
        Effect.flatMap(Effect.sleep(1), () =>
          Effect.sync(() => {
            events.push(event)
          }),
        ),
    }
    const flow = workflow("checkout", {
      id: "order_serial",
      transport,
    })

    flow.step("payment-created")
    flow.done()

    await vi.waitFor(() => expect(events).toHaveLength(3))
    expect(events.map(({ type }) => type)).toEqual([
      "started",
      "step",
      "completed",
    ])
  })

  it("contains asynchronous transport failures", async () => {
    const transport = {
      emit: vi.fn(() =>
        Effect.promise(async () => {
          throw new Error("delivery failed")
        }),
      ),
    }
    const onInstrumentationError = vi.fn(
      (error: unknown, event: WorkflowEvent) => {
        expect(error).toBeDefined()
        expect(event.type).toBeDefined()
      },
    )
    const flow = workflow("checkout", {
      id: "order_async",
      transport,
      onInstrumentationError,
    })

    flow.done()

    await vi.waitFor(() => {
      expect(onInstrumentationError).toHaveBeenCalledTimes(2)
    })
    expect(onInstrumentationError.mock.calls[1]?.[0]).toMatchObject({
      _tag: "WorkflowTransportError",
    })
  })

  it("timestamps markers before waiting for earlier deliveries", async () => {
    const events: WorkflowEvent[] = []
    let release!: () => void
    const waiting = new Promise<void>((resolve) => {
      release = resolve
    })
    const transport = {
      emit: (event: WorkflowEvent) =>
        Effect.gen(function* () {
          if (event.type === "started") {
            yield* Effect.promise(() => waiting)
          }
          yield* Effect.sync(() => {
            events.push(event)
          })
        }),
    }
    const flow = workflow("timestamp-test", { id: "test", transport })
    flow.done()
    await new Promise((resolve) => setTimeout(resolve, 30))
    const deliveryStartedAt = Date.now()
    release()
    await vi.waitFor(() => expect(events).toHaveLength(2))
    expect(Date.parse(events[1].timestamp)).toBeLessThan(deliveryStartedAt)
  })
})
