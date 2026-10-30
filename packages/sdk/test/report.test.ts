import { Effect, Layer, Schema } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"
import { WorkflowEventSchema } from "@flowmarkdev/core"
import { makeClient } from "../src/client/runtime.js"
import { WorkflowTransport } from "../src/features/delivery/ports/workflow-transport.js"
import { createFlowmark, MemoryTransport, workflow } from "../src/index.js"
import { createFlowmark as browserClient } from "../src/browser/index.js"

afterEach(() => vi.unstubAllGlobals())

describe("business snapshots", () => {
  it("validates report JSON at the shared trust boundary", () => {
    const base = {
      type: "report",
      workflow: "import",
      runId: "1",
      timestamp: new Date().toISOString(),
    }
    expect(Schema.is(WorkflowEventSchema)({ ...base, result: {} })).toBe(true)
    for (const result of [
      null,
      [],
      { invalid: Infinity },
      { invalid: undefined },
      { invalid: "x".repeat(2049) },
    ]) {
      expect(Schema.is(WorkflowEventSchema)({ ...base, result })).toBe(false)
    }
  })

  it("retains separate whole snapshots, diagnoses invalid input and never inherits a final result", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const transport = new MemoryTransport()
        const diagnostic = vi.fn()
        const client = makeClient(
          Layer.succeed(WorkflowTransport, transport),
          diagnostic,
        )
        const flow = client.workflow("customer.import")
        flow.report({ imported: 10, rejected: 2 })
        flow.report({ imported: 20 })
        flow.report({ imported: Infinity })
        const operation = flow.operation("save")
        flow.done()
        flow.report({ imported: 99 })
        operation.done()
        flow.report({ imported: 100 })
        yield* Effect.promise(() => client.flush()).pipe(Effect.exit)
        expect(diagnostic).toHaveBeenCalledOnce()
        expect(
          transport.events.filter((event) => event.type === "report"),
        ).toEqual([
          expect.objectContaining({ result: { imported: 10, rejected: 2 } }),
          expect.objectContaining({ result: { imported: 20 } }),
        ])
        expect(transport.events.at(-1)).toMatchObject({ type: "completed" })
        expect(transport.events.at(-1)).not.toHaveProperty("result")
        yield* Effect.promise(() => client.shutdown()).pipe(Effect.exit)
      }),
    ))

  it("diagnoses an unsupported server without disguising a report as another marker", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const diagnostic = vi.fn()
        const events: string[] = []
        vi.stubGlobal(
          "fetch",
          vi.fn<typeof fetch>((_url, options) =>
            Effect.runPromise(
              Effect.promise(() => new Response(options?.body).text()).pipe(
                Effect.map((body) => {
                  const { event } = JSON.parse(body)
                  events.push(event.type)
                  return new Response(null, {
                    status: event.type === "report" ? 400 : 202,
                  })
                }),
              ),
            ),
          ),
        )
        const client = createFlowmark({
          apiKey: "test-only",
          apiUrl: "http://localhost",
          onInstrumentationError: diagnostic,
        })
        const flow = client.workflow("import")
        flow.report({ imported: 20 })
        flow.done()
        const drained = yield* Effect.promise(() => client.flush()).pipe(
          Effect.exit,
        )
        expect(drained._tag).toBe("Failure")
        expect(diagnostic).toHaveBeenCalledOnce()
        expect(diagnostic.mock.calls[0]?.[1]).toMatchObject({ type: "report" })
        expect(events).toEqual(["started", "report", "completed"])
        yield* Effect.promise(() => client.shutdown()).pipe(Effect.exit)
      }),
    ))

  it("supports the advanced lifecycle without changing final failure data", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const transport = new MemoryTransport()
        const flow = workflow("crm.sync", { id: "crm-report", transport })
        flow.report({ updated: 400, reasons: { rejected: 2 } })
        flow.fail({
          code: "TIMEOUT",
          outcome: "partial",
          result: { updated: 350 },
        })
        flow.report({ updated: 999 })
        yield* Effect.promise(() =>
          vi.waitFor(() => expect(transport.events).toHaveLength(3)),
        )
        expect(transport.events.at(-1)).toMatchObject({
          type: "failed",
          result: { updated: 350 },
        })
      }),
    ))

  it("delivers browser reports through the existing same-origin lifecycle", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        vi.stubGlobal("location", { origin: "https://app.example" })
        const events: unknown[] = []
        vi.stubGlobal(
          "fetch",
          vi.fn<typeof fetch>((_url, options) =>
            Effect.runPromise(
              Effect.promise(() => new Response(options?.body).text()).pipe(
                Effect.map((body) => {
                  events.push(JSON.parse(body).event)
                  return new Response(null, { status: 202 })
                }),
              ),
            ),
          ),
        )
        const client = browserClient()
        const flow = client.workflow("browser.import")
        flow.report({ imported: 20 })
        flow.done()
        yield* Effect.promise(() => client.shutdown())
        expect(events).toEqual([
          expect.objectContaining({ type: "started" }),
          expect.objectContaining({ type: "report", result: { imported: 20 } }),
          expect.objectContaining({ type: "completed" }),
        ])
      }),
    ))
})
