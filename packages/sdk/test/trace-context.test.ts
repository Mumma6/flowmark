import { Array, Effect, Option, Result, Schema, pipe } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createFlowmarkWithTransport, MemoryTransport } from "../src/index.js"
import {
  TraceReferenceSchema,
  captureTraceProperties,
  traceOperationOptions,
} from "../examples/trace-context/recipe.js"
import {
  resolveSyntheticSpan,
  runTraceContextProof,
  syntheticSpans,
} from "./trace-context.fixture.js"

afterEach(() => vi.unstubAllGlobals())

describe("explicit application-owned trace references", () => {
  it("selects fresh bounded values without reading baggage, attributes or URLs", () => {
    const context = {
      ...syntheticSpans[0],
      get baggage() {
        throw new Error("must not read baggage")
      },
      get attributes() {
        throw new Error("must not read attributes")
      },
      get url() {
        throw new Error("must not read URLs")
      },
    }
    const properties = captureTraceProperties(
      () => context,
      "booking-api",
    ).pipe(Result.getOrThrow)
    expect(properties).toEqual({
      traceContext: {
        traceId: syntheticSpans[0].traceId,
        spanId: syntheticSpans[0].spanId,
        serviceName: "booking-api",
      },
    })
    expect(Object.is(properties.traceContext, context)).toBe(false)
    expect(
      new TextEncoder().encode(JSON.stringify(properties)).byteLength,
    ).toBeLessThanOrEqual(256)
    const maximum = captureTraceProperties(() => context, "a".repeat(80)).pipe(
      Result.getOrThrow,
    )
    expect(
      new TextEncoder().encode(JSON.stringify(maximum)).byteLength,
    ).toBeLessThanOrEqual(256)
  })

  it.each([
    ["zero trace", { ...syntheticSpans[0], traceId: "0".repeat(32) }],
    ["zero span", { ...syntheticSpans[0], spanId: "0".repeat(16) }],
    ["newline trace", { ...syntheticSpans[0], traceId: "1".repeat(32) + "\n" }],
    ["short trace", { ...syntheticSpans[0], traceId: "1234" }],
    ["long span", { ...syntheticSpans[0], spanId: "1".repeat(17) }],
    ["uppercase", { ...syntheticSpans[0], traceId: "A".repeat(32) }],
    ["nonhex", { ...syntheticSpans[0], spanId: "z".repeat(16) }],
    ["wrong type", { traceId: 42, spanId: null }],
  ])("omits invalid context: %s", (_name, context) => {
    const selection = captureTraceProperties(() => context, "booking-api")
    expect(Result.getFailure(selection).pipe(Option.getOrThrow).reason).toBe(
      "invalid",
    )
    expect(traceOperationOptions(() => context, "booking-api")).toEqual({})
  })

  it.each([
    "",
    "a".repeat(81),
    " booking",
    "secret@example.com",
    "é",
    "service\n",
  ])("rejects invalid service name %j", (service) => {
    expect(traceOperationOptions(() => syntheticSpans[0], service)).toEqual({})
  })

  it("keeps missing and failed readers distinct without retaining their errors", () => {
    expect(
      captureTraceProperties(() => undefined, "booking-api").pipe(
        Result.getFailure,
        Option.getOrThrow,
      ).reason,
    ).toBe("missing")
    const selection = captureTraceProperties(() => {
      throw new Error("private request secret")
    }, "booking-api")
    expect(selection.pipe(Result.getFailure, Option.getOrThrow).reason).toBe(
      "reader-failed",
    )
    expect(JSON.stringify(selection)).not.toContain("private request secret")
    expect(
      traceOperationOptions(() => {
        throw new Error("secret")
      }, "booking-api"),
    ).toEqual({})
  })

  it("snapshots mutable reader values and isolates overlapping run identities", async () => {
    const transport = new MemoryTransport()
    const client = createFlowmarkWithTransport({ transport })
    await Effect.runPromise(
      Effect.acquireUseRelease(
        Effect.succeed(client),
        (client) =>
          Effect.sync(() => {
            const context: { traceId: string; spanId: string } = {
              traceId: syntheticSpans[0].traceId,
              spanId: syntheticSpans[0].spanId,
            }
            const first = client.workflow("booking.trace-proof", {
              id: "first-booking",
            })
            const second = client.workflow("booking.trace-proof", {
              id: "second-booking",
            })
            const firstOperation = first.operation(
              "reserve",
              traceOperationOptions(() => context, "booking-api"),
            )
            context.traceId = syntheticSpans[1].traceId
            context.spanId = syntheticSpans[1].spanId
            const secondOperation = second.operation(
              "reserve",
              traceOperationOptions(() => context, "booking-api"),
            )
            secondOperation.done()
            second.done({ result: { confirmed: 0 } })
            firstOperation.done()
            first.done({ result: { confirmed: 1 } })
          }),
        (client) => Effect.promise(() => client.shutdown()),
      ),
    )
    expect(
      Array.filter(
        transport.events,
        (event) => event.type === "operation_started",
      ),
    ).toMatchObject([
      {
        runId: "first-booking",
        properties: {
          traceContext: {
            traceId: syntheticSpans[0].traceId,
            spanId: syntheticSpans[0].spanId,
          },
        },
      },
      {
        runId: "second-booking",
        properties: {
          traceContext: {
            traceId: syntheticSpans[1].traceId,
            spanId: syntheticSpans[1].spanId,
          },
        },
      },
    ])
  })

  it("isolates concurrent and continued operations and resolves only owned synthetic evidence", async () => {
    const fetch = vi.fn(() => {
      throw new Error("no network permitted")
    })
    vi.stubGlobal("fetch", fetch)
    const proof = await Effect.runPromise(
      runTraceContextProof().pipe(Effect.scoped),
    )
    const starts = Array.filter(
      proof.events,
      (event) => event.type === "started",
    )
    expect(starts).toHaveLength(2)
    expect(starts[1]).not.toHaveProperty("properties")
    expect(starts[0]).toMatchObject({
      runId: "synthetic-booking",
      correlationId: "synthetic-order",
      parentRunId: "synthetic-parent",
      properties: { traceContext: { traceId: syntheticSpans[0].traceId } },
    })
    const operations = Array.filter(
      proof.events,
      (event) => event.type === "operation_started",
    )
    expect(
      Array.map(operations, (event) => event.properties?.traceContext),
    ).toEqual([
      {
        traceId: syntheticSpans[0].traceId,
        spanId: syntheticSpans[0].spanId,
        serviceName: "booking-api",
      },
      {
        traceId: syntheticSpans[1].traceId,
        spanId: syntheticSpans[1].spanId,
        serviceName: "booking-api",
      },
      {
        traceId: syntheticSpans[2].traceId,
        spanId: syntheticSpans[2].spanId,
        serviceName: "booking-api",
      },
    ])
    expect(
      Array.map(Array.take(proof.events, 3), (event) => event.type),
    ).toEqual(["started", "operation_started", "operation_started"])
    expect(
      Array.dedupe(Array.map(operations, (event) => event.operationId)).length,
    ).toBe(3)
    expect(
      Array.every(proof.events, (event) => event.runId === proof.runId),
    ).toBe(true)
    expect(
      Array.some(proof.events, (event) => event.type === "properties"),
    ).toBe(false)
    expect(proof.values).toEqual(
      Array.map(Array.take(syntheticSpans, 2), (span) => span.name),
    )
    expect(proof.events.at(-1)).toMatchObject({
      type: "completed",
      outcome: "partial",
      result: { confirmed: 0, requested: 2 },
    })
    Array.forEach(operations, (event) => {
      const selected = Schema.decodeUnknownResult(TraceReferenceSchema)(
        event.properties?.traceContext,
      ).pipe(Result.getOrThrow)
      expect(
        resolveSyntheticSpan(selected).pipe(Option.getOrThrow).status,
      ).toBe("ok")
      expect(proof.events).toContainEqual(
        expect.objectContaining({
          type: "operation_completed",
          operationId: event.operationId,
        }),
      )
    })
    expect(
      resolveSyntheticSpan({
        ...syntheticSpans[0],
        spanId: "3333333333333333",
      }).pipe(Option.isNone),
    ).toBe(true)
    expect(
      resolveSyntheticSpan({
        ...syntheticSpans[0],
        serviceName: "another-service",
      }).pipe(Option.isNone),
    ).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("preserves application values and original rejections when optional context is unavailable", async () => {
    const transport = new MemoryTransport()
    const client = createFlowmarkWithTransport({ transport })
    const error = new Error("application-owned failure")
    await Effect.runPromise(
      Effect.acquireUseRelease(
        Effect.succeed(client),
        (client) =>
          Effect.gen(function* () {
            const flow = client.workflow("optional.trace")
            const value = { accepted: true }
            expect(
              yield* Effect.promise(() =>
                flow.operation(
                  "missing",
                  () => Promise.resolve(value),
                  traceOperationOptions(() => null, "booking-api"),
                ),
              ),
            ).toBe(value)
            const rejected = yield* Effect.tryPromise({
              try: () =>
                flow.operation(
                  "invalid",
                  () => Promise.reject(error),
                  traceOperationOptions(
                    () => ({ traceId: "bad", spanId: "bad" }),
                    "booking-api",
                  ),
                ),
              catch: (cause) => cause,
            }).pipe(Effect.result)
            expect(rejected.pipe(Result.getFailure, Option.getOrThrow)).toBe(
              error,
            )
            expect(
              yield* Effect.promise(() =>
                flow.operation(
                  "reader failed",
                  () => Promise.resolve(42),
                  traceOperationOptions(() => {
                    throw new Error("private")
                  }, "booking-api"),
                ),
              ),
            ).toBe(42)
            flow.done({
              outcome: "partial",
              result: { accepted: 1, rejected: 1 },
            })
          }),
        (client) => Effect.promise(() => client.shutdown()),
      ),
    )
    expect(
      pipe(
        transport.events,
        Array.filter((event) => event.type === "operation_started"),
        Array.every((event) => event.properties === undefined),
      ),
    ).toBe(true)
    expect(transport.events.at(-1)).toMatchObject({
      type: "completed",
      outcome: "partial",
      result: { accepted: 1, rejected: 1 },
    })
  })
})
