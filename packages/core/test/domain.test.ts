import { Effect, Result, Schema } from "effect"
import { describe, expect, it } from "vitest"
import { decodeWorkflowEvent, EventEnvelopeSchema } from "../src/index.js"

describe("workflow event schema", () => {
  it.each([
    "00000000-0000-1000-0000-000000000000",
    "00000000-0000-9000-0000-000000000000",
    "ABCDEFAB-CDEF-ABCD-EFAB-CDEFABCDEFAB",
    "00000000-0000-0000-0000-000000000000",
  ])(
    "preserves UUID-shape acceptance for event and operation IDs: %s",
    (id) => {
      const event = {
        type: "operation_completed",
        workflow: "import",
        runId: "run-1",
        timestamp: "2026-10-30T12:00:00.000Z",
        operationId: id,
        operationName: "save",
        durationMs: 1,
      }
      expect(
        Schema.decodeUnknownSync(EventEnvelopeSchema)({ eventId: id, event }),
      ).toEqual({ eventId: id, event })
      expect(
        Schema.is(EventEnvelopeSchema)({ eventId: id.slice(1), event }),
      ).toBe(false)
      expect(
        Schema.is(EventEnvelopeSchema)({
          eventId: id,
          event: { ...event, operationId: id.replaceAll("-", "") },
        }),
      ).toBe(false)
    },
  )

  it("decodes a valid event without changing its data", () => {
    const event = {
      type: "started",
      workflow: "checkout",
      runId: "order_123",
      timestamp: "2026-10-23T12:00:00.000Z",
      properties: { provider: "stripe" },
    } as const
    const result = Effect.runSync(Effect.result(decodeWorkflowEvent(event)))
    Result.match(result, {
      onFailure: () => expect.fail("Expected a valid workflow event"),
      onSuccess: (decoded) => expect(decoded).toEqual(event),
    })
  })

  it("returns a tagged validation error with the rejected input and parse cause", () => {
    const input = { type: "unknown", workflow: "checkout" }
    const result = Effect.runSync(Effect.result(decodeWorkflowEvent(input)))
    Result.match(result, {
      onFailure: (error) => {
        expect(error._tag).toBe("WorkflowEventValidationError")
        expect(error.input).toBe(input)
        expect(error.cause).toBeDefined()
      },
      onSuccess: () =>
        expect.fail("Expected a workflow event validation error"),
    })
  })

  it("accepts bounded JSON-safe properties, amendments, failures, errors and results", () => {
    const events = [
      {
        type: "started",
        workflow: "checkout",
        runId: "run-1",
        timestamp: "2026-10-23T12:00:00.000Z",
        properties: { cart: { items: ["book"], count: 1 } },
        environment: "production",
        release: "2026.10.23",
      },
      {
        type: "properties",
        workflow: "checkout",
        runId: "run-1",
        timestamp: "2026-10-23T12:01:00.000Z",
        properties: { region: "eu-west" },
      },
      {
        type: "error",
        workflow: "checkout",
        runId: "run-1",
        timestamp: "2026-10-23T12:02:00.000Z",
        error: {
          code: "inventory-unavailable",
          message: "Retry scheduled",
          retryable: true,
          handled: true,
        },
      },
      {
        type: "failed",
        workflow: "checkout",
        runId: "run-1",
        timestamp: "2026-10-23T12:03:00.000Z",
        failure: { code: "payment-declined", retryable: false },
        result: { captured: false },
      },
      {
        type: "completed",
        workflow: "checkout",
        runId: "run-1",
        timestamp: "2026-10-23T12:04:00.000Z",
        result: { receipt: { id: "receipt-1" } },
      },
    ]
    for (const event of events) {
      expect(Effect.runSync(decodeWorkflowEvent(event))).toEqual(event)
    }
  })

  it("accepts operation lifecycle and absolute progress events", () => {
    const events = [
      {
        type: "operation_started",
        workflow: "checkout",
        runId: "run-1",
        timestamp: "2026-10-23T12:00:00.000Z",
        operationId: "00000000-0000-4000-8000-000000000011",
        operationName: "charge-payment",
        properties: { provider: "stripe" },
      },
      {
        type: "operation_completed",
        workflow: "checkout",
        runId: "run-1",
        timestamp: "2026-10-23T12:00:00.025Z",
        operationId: "00000000-0000-4000-8000-000000000011",
        operationName: "charge-payment",
        durationMs: 25.5,
      },
      {
        type: "operation_started",
        workflow: "checkout",
        runId: "run-1",
        timestamp: "2026-10-23T12:00:00.030Z",
        operationId: "00000000-0000-4000-8000-000000000012",
        operationName: "reserve-stock",
      },
      {
        type: "operation_failed",
        workflow: "checkout",
        runId: "run-1",
        timestamp: "2026-10-23T12:00:00.060Z",
        operationId: "00000000-0000-4000-8000-000000000012",
        operationName: "reserve-stock",
        durationMs: 30,
        failure: { code: "out-of-stock" },
      },
      {
        type: "progress",
        workflow: "checkout",
        runId: "run-1",
        timestamp: "2026-10-23T12:00:00.065Z",
        completed: 3,
        total: 10,
        unit: "items",
      },
      {
        type: "progress",
        workflow: "checkout",
        runId: "run-1",
        timestamp: "2026-10-23T12:00:00.070Z",
        completed: 0,
      },
    ]
    for (const event of events) {
      expect(Effect.runSync(decodeWorkflowEvent(event))).toEqual(event)
    }
  })

  it("accepts bounded explicit correlation metadata on started events", () => {
    const event = {
      type: "started",
      workflow: "checkout",
      runId: "child-run",
      timestamp: "2026-10-23T12:00:00.000Z",
      correlationId: "request-123",
      parentRunId: "parent-run",
    }
    expect(Effect.runSync(decodeWorkflowEvent(event))).toEqual(event)
    expect(
      Effect.runSync(
        decodeWorkflowEvent({
          ...event,
          correlationId: "c".repeat(128),
          parentRunId: "p".repeat(200),
        }),
      ),
    ).toMatchObject({
      correlationId: "c".repeat(128),
      parentRunId: "p".repeat(200),
    })
    for (const metadata of [
      { correlationId: " " },
      { correlationId: "c".repeat(129) },
      { parentRunId: "p".repeat(201) },
      { parentRunId: "child-run" },
    ]) {
      Result.match(
        Effect.runSync(
          Effect.result(
            decodeWorkflowEvent({
              ...event,
              ...metadata,
            }),
          ),
        ),
        {
          onFailure: () => undefined,
          onSuccess: () => expect.fail("expected invalid run metadata"),
        },
      )
    }
  })

  it.each([
    {
      name: "raw Error",
      event: {
        type: "started",
        workflow: "checkout",
        runId: "run-1",
        timestamp: "2026-10-23T12:00:00.000Z",
        properties: { cause: new Error("private detail") },
      },
    },
    {
      name: "nested value beyond the depth bound",
      event: {
        type: "started",
        workflow: "checkout",
        runId: "run-1",
        timestamp: "2026-10-23T12:00:00.000Z",
        properties: { a: { b: { c: { d: { e: { f: "too deep" } } } } } },
      },
    },
    {
      name: "too many keys",
      event: {
        type: "started",
        workflow: "checkout",
        runId: "run-1",
        timestamp: "2026-10-23T12:00:00.000Z",
        properties: Object.fromEntries(
          Array.from({ length: 129 }, (_, index) => [`key-${index}`, index]),
        ),
      },
    },
    {
      name: "oversized string",
      event: {
        type: "started",
        workflow: "checkout",
        runId: "run-1",
        timestamp: "2026-10-23T12:00:00.000Z",
        properties: { value: "x".repeat(2049) },
      },
    },
    {
      name: "oversized encoded object",
      event: {
        type: "started",
        workflow: "checkout",
        runId: "run-1",
        timestamp: "2026-10-23T12:00:00.000Z",
        properties: { value: "x".repeat(16 * 1024) },
      },
    },
    {
      name: "raw Error failure",
      event: {
        type: "failed",
        workflow: "checkout",
        runId: "run-1",
        timestamp: "2026-10-23T12:00:00.000Z",
        failure: new Error("private detail"),
      },
    },
    {
      name: "oversized failure code",
      event: {
        type: "failed",
        workflow: "checkout",
        runId: "run-1",
        timestamp: "2026-10-23T12:00:00.000Z",
        failure: { code: "x".repeat(129) },
      },
    },
    {
      name: "oversized error message",
      event: {
        type: "error",
        workflow: "checkout",
        runId: "run-1",
        timestamp: "2026-10-23T12:00:00.000Z",
        error: { code: "failed", message: "x".repeat(2049), handled: false },
      },
    },
    {
      name: "negative progress",
      event: {
        type: "progress",
        workflow: "checkout",
        runId: "run-1",
        timestamp: "2026-10-23T12:00:00.000Z",
        completed: -1,
      },
    },
    {
      name: "fractional progress",
      event: {
        type: "progress",
        workflow: "checkout",
        runId: "run-1",
        timestamp: "2026-10-23T12:00:00.000Z",
        completed: 1.5,
      },
    },
    {
      name: "progress above total",
      event: {
        type: "progress",
        workflow: "checkout",
        runId: "run-1",
        timestamp: "2026-10-23T12:00:00.000Z",
        completed: 5,
        total: 4,
      },
    },
    {
      name: "negative progress total",
      event: {
        type: "progress",
        workflow: "checkout",
        runId: "run-1",
        timestamp: "2026-10-23T12:00:00.000Z",
        completed: 0,
        total: -1,
      },
    },
    {
      name: "negative operation duration",
      event: {
        type: "operation_completed",
        workflow: "checkout",
        runId: "run-1",
        timestamp: "2026-10-23T12:00:00.000Z",
        operationId: "00000000-0000-4000-8000-000000000011",
        operationName: "charge-payment",
        durationMs: -1,
      },
    },
  ])("rejects $name", ({ event }) => {
    const result = Effect.runSync(Effect.result(decodeWorkflowEvent(event)))
    Result.match(result, {
      onFailure: () => undefined,
      onSuccess: () => expect.fail("expected an invalid workflow event"),
    })
  })
})
