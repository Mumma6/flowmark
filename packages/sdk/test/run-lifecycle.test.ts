import { Deferred, Effect, Layer } from "effect"
import { describe, expect, it, vi } from "vitest"
import { makeClient } from "../src/client/runtime.js"
import {
  MemoryTransport,
  WorkflowTransport,
  type WorkflowEvent,
} from "../src/index.js"

function clientWithMemory() {
  const transport = new MemoryTransport()
  const client = makeClient(Layer.succeed(WorkflowTransport, transport))
  return { client, events: transport.events }
}

describe("run lifecycle characterization", () => {
  it("isolates pending completion and properties between overlapping runs", async () => {
    const { client, events } = clientWithMemory()
    const first = client.workflow("import", { id: "first" })
    const second = client.workflow("import", { id: "second" })
    const firstOperation = first.operation("load")
    const secondOperation = second.operation("load")
    first.done({ outcome: "partial", result: { rows: 1 } })
    first.done({ outcome: "ignored", result: { rows: 100 } })
    first.setProperties({ ignored: true })
    first.report({ ignored: true })
    first.error({ code: "ignored", handled: true })
    first.progress({ completed: 100 })
    first.step("ignored")
    first.operation("ignored").done()
    second.setProperties({ region: "eu" })
    second.report({ rows: 2 })
    second.progress({ completed: 2 })
    secondOperation.done()
    second.done({ result: { rows: 2 } })
    await client.flush()
    expect(
      events.filter((event) => event.runId === "first").map((e) => e.type),
    ).toEqual(["started", "operation_started", "properties"])
    expect(
      events.filter((event) => event.runId === "second").map((e) => e.type),
    ).toEqual([
      "started",
      "operation_started",
      "properties",
      "report",
      "progress",
      "operation_completed",
      "completed",
    ])
    firstOperation.fail({ code: "row-rejected" })
    await client.shutdown()
    expect(events.at(-1)).toMatchObject({
      type: "completed",
      runId: "first",
      outcome: "partial",
      result: { rows: 1 },
    })
  })

  it("retains the shared client's existing property updates during pending completion", async () => {
    const { client, events } = clientWithMemory()
    const flow = client.workflow("import")
    const operation = flow.operation("load")
    flow.done()
    flow.setProperties({ phase: "closing" })
    operation.done()
    flow.setProperties({ ignored: true })
    await client.shutdown()
    expect(events.map((event) => event.type)).toEqual([
      "started",
      "operation_started",
      "properties",
      "operation_completed",
      "completed",
    ])
    expect(events[2]).toMatchObject({ properties: { phase: "closing" } })
  })

  it("keeps operation terminals idempotent and preserves the first completion request", async () => {
    const { client, events } = clientWithMemory()
    const flow = client.workflow("import")
    const first = flow.operation("load")
    const second = flow.operation("save")
    flow.done({ result: { rows: 3 } })
    first.fail({ code: "rejected" })
    first.done()
    first.fail({ code: "ignored" })
    second.done()
    second.fail({ code: "ignored" })
    flow.fail({ code: "ignored" })
    flow.done()
    await client.shutdown()
    expect(events.map((event) => event.type)).toEqual([
      "started",
      "operation_started",
      "operation_started",
      "operation_failed",
      "operation_completed",
      "completed",
    ])
    expect(events.at(-1)).toMatchObject({ result: { rows: 3 } })
  })

  it("allows failure to replace pending completion and suppresses late operation closes", async () => {
    const { client, events } = clientWithMemory()
    const flow = client.workflow("import")
    const operation = flow.operation("load")
    flow.done({ result: { ignored: true } })
    flow.fail({
      code: "cancelled-by-app",
      outcome: "partial",
      result: { rows: 0 },
    })
    operation.fail({ code: "late" })
    operation.done()
    flow.fail({ code: "ignored" })
    await client.shutdown()
    expect(events.map((event) => event.type)).toEqual([
      "started",
      "operation_started",
      "failed",
    ])
    expect(events.at(-1)).toMatchObject({
      failure: { code: "cancelled-by-app" },
      outcome: "partial",
      result: { rows: 0 },
    })
  })

  it("completes after overlapping callbacks settle without replacing an application rejection", async () => {
    const { client, events } = clientWithMemory()
    const flow = client.workflow("import")
    let resolve!: (value: string) => void
    let reject!: (reason: unknown) => void
    const success = flow.operation(
      "load",
      () =>
        new Promise<string>((r) => {
          resolve = r
        }),
    )
    const failure = flow.operation(
      "save",
      () =>
        new Promise<string>((_, r) => {
          reject = r
        }),
    )
    const original = new Error("application failure")
    const rejected = expect(failure).rejects.toBe(original)
    flow.done()
    reject(original)
    await rejected
    await client.flush()
    expect(events.some((event) => event.type === "completed")).toBe(false)
    resolve("loaded")
    await expect(success).resolves.toBe("loaded")
    await client.shutdown()
    expect(events.map((event) => event.type)).toEqual([
      "started",
      "operation_started",
      "operation_started",
      "operation_failed",
      "operation_completed",
      "completed",
    ])
  })

  it("orders each run independently while another run's delivery is blocked", async () => {
    const gate = Effect.runSync(Deferred.make<void>())
    const events: WorkflowEvent[] = []
    const client = makeClient(
      Layer.succeed(WorkflowTransport, {
        emit: (event) =>
          Effect.gen(function* () {
            if (event.runId === "blocked" && event.type === "started") {
              yield* Deferred.await(gate)
            }
            events.push(event)
          }),
      }),
    )
    const blocked = client.workflow("import", { id: "blocked" })
    blocked.step("loaded")
    blocked.done()
    client.workflow("import", { id: "free" }).done()
    await vi.waitFor(() =>
      expect(events.map((event) => event.type)).toEqual([
        "started",
        "completed",
      ]),
    )
    expect(events.every((event) => event.runId === "free")).toBe(true)
    Effect.runSync(Deferred.succeed(gate, undefined))
    await client.shutdown()
    expect(
      events.filter((event) => event.runId === "blocked").map((e) => e.type),
    ).toEqual(["started", "step", "completed"])
  })

  it("drains shutdown without synthesizing completion for open operations", async () => {
    const { client, events } = clientWithMemory()
    const flow = client.workflow("import")
    const operation = flow.operation("load")
    flow.done()
    const shutdown = client.shutdown()
    expect(client.shutdown()).toBe(shutdown)
    await shutdown
    operation.done()
    flow.fail({ code: "late" })
    await expect(
      flow.operation("late", async () => "still runs"),
    ).resolves.toBe("still runs")
    expect(events.map((event) => event.type)).toEqual([
      "started",
      "operation_started",
    ])
  })
})
