import { Array, Deferred, Effect, Layer, pipe } from "effect"
import { describe, expect, it } from "vitest"
import type { WorkflowEvent } from "@flowmarkdev/core"
import { makeClient } from "../src/client/runtime.js"
import { WorkflowTransport } from "../src/delivery/ports/workflow-transport.js"
import type { DeliveryOptions } from "../src/types/index.js"

function blockedClient(delivery: DeliveryOptions = {}) {
  const gate = Effect.runSync(Deferred.make<void>())
  const events: WorkflowEvent[] = []
  let diagnostics = 0
  const client = makeClient(
    Layer.succeed(WorkflowTransport, {
      emit: (event) =>
        Deferred.await(gate).pipe(
          Effect.andThen(
            Effect.sync(() => {
              events.push(event)
            }),
          ),
        ),
    }),
    () => {
      diagnostics++
    },
    {},
    delivery,
  )
  return {
    client,
    events,
    diagnostics: () => diagnostics,
    release: () => Effect.runSync(Deferred.succeed(gate, undefined)),
  }
}

describe("bounded bulk delivery", () => {
  it("coalesces repeated absolute snapshots and preserves the final progress, report, operation pair and terminal", async () => {
    const snapshots = 8
    const { client, events, release } = blockedClient({ progress: "latest" })
    const flow = client.workflow("bulk")
    const operation = flow.operation("import")
    // Replacement is per unsent slot. Queue capacity is covered separately.
    pipe(
      Array.range(1, snapshots),
      Array.forEach((completed) =>
        flow.progress({ completed, total: snapshots, unit: "records" }),
      ),
    )
    expect(client.deliveryHealth()).toMatchObject({
      pending: 3,
      pendingProgress: 1,
      coalesced: snapshots - 1,
      dropped: 0,
      failed: 0,
    })
    flow.report({ saved: snapshots })
    flow.done({ result: { saved: snapshots } })
    operation.done()
    expect(client.deliveryHealth().pending).toBe(6)
    release()
    await client.shutdown()
    expect(events.map((event) => event.type)).toEqual([
      "started",
      "operation_started",
      "progress",
      "report",
      "operation_completed",
      "completed",
    ])
    expect(events[2]).toMatchObject({
      completed: snapshots,
      total: snapshots,
    })
    expect(events[5]).toMatchObject({ result: { saved: snapshots } })
    expect(client.deliveryHealth()).toMatchObject({
      pending: 0,
      pendingProgress: 0,
      coalesced: snapshots - 1,
      failed: 0,
    })
  })

  it("never replaces an in-flight snapshot and replaces whole absolute payloads", async () => {
    const entered = Effect.runSync(Deferred.make<void>())
    const gate = Effect.runSync(Deferred.make<void>())
    const events: WorkflowEvent[] = []
    const client = makeClient(
      Layer.succeed(WorkflowTransport, {
        emit: (event) =>
          Effect.gen(function* () {
            events.push(event)
            if (event.type === "progress" && event.completed === 1) {
              yield* Deferred.succeed(entered, undefined)
              yield* Deferred.await(gate)
            }
          }),
      }),
      undefined,
      {},
      { progress: "latest" },
    )
    const flow = client.workflow("in-flight")
    flow.progress({ completed: 1, total: 10, unit: "rows" })
    await Effect.runPromise(Deferred.await(entered))
    flow.progress({ completed: 2, total: 10, unit: "rows" })
    flow.progress({ completed: 3 })
    flow.done()
    Effect.runSync(Deferred.succeed(gate, undefined))
    await client.shutdown()
    const snapshots = events.filter((event) => event.type === "progress")
    expect(snapshots).toHaveLength(2)
    expect(snapshots[0]).toMatchObject({
      completed: 1,
      total: 10,
      unit: "rows",
    })
    expect(snapshots[1]).toMatchObject({ completed: 3 })
    expect(snapshots[1]).not.toHaveProperty("total")
    expect(snapshots[1]).not.toHaveProperty("unit")
    expect(client.deliveryHealth().coalesced).toBe(1)
  })

  it("seals progress at every intervening marker and at flush boundaries", async () => {
    const { client, events, release } = blockedClient({ progress: "latest" })
    const flow = client.workflow("boundaries")
    flow.progress({ completed: 1 })
    flow.progress({ completed: 2 })
    flow.step("checkpoint")
    flow.progress({ completed: 3 })
    const drain = client.flush()
    flow.progress({ completed: 4 })
    flow.progress({ completed: 5 })
    flow.done()
    release()
    await drain
    await client.shutdown()
    expect(
      events
        .filter((event) => event.type === "progress")
        .map((event) => event.completed),
    ).toEqual([2, 3, 5])
    expect(events.map((event) => event.type)).toEqual([
      "started",
      "progress",
      "step",
      "progress",
      "progress",
      "completed",
    ])
  })

  it("keeps default history per call and reserves bounded space against snapshot saturation", async () => {
    const { client, events, diagnostics, release } = blockedClient()
    const flow = client.workflow("default")
    // Cross the 900-entry snapshot limit and the 20-failure sample limit
    // without repeating thousands of rejected calls on slower CI runners.
    pipe(
      Array.range(1, 1_000),
      Array.forEach((completed) => flow.progress({ completed })),
    )
    flow.report({ saved: 1_000 })
    const operation = flow.operation("commit")
    operation.done()
    flow.done({ result: { saved: 1_000 } })
    expect(client.deliveryHealth()).toMatchObject({
      pending: 903,
      coalesced: 0,
      dropped: 102,
    })
    release()
    await expect(client.flush()).rejects.toMatchObject({
      failureCount: 102,
      omittedFailureCount: 82,
      failures: { length: 20 },
    })
    expect(diagnostics()).toBe(102)
    expect(events.filter((event) => event.type === "progress")).toHaveLength(
      899,
    )
    expect(events.slice(-3).map((event) => event.type)).toEqual([
      "operation_started",
      "operation_completed",
      "completed",
    ])
    // Drains reset error samples, never cumulative health.
    await client.flush()
    expect(client.deliveryHealth()).toMatchObject({ pending: 0, dropped: 102 })
    await client.shutdown()
  })

  it("validates every replaced snapshot and retains bounded failure samples without losing valid progress", async () => {
    const { client, events, release } = blockedClient({ progress: "latest" })
    const flow = client.workflow("validation")
    flow.progress({ completed: 1 })
    for (let index = 0; index < 100; index++) {
      flow.progress({ completed: -1 })
    }
    flow.progress({ completed: 2 })
    flow.done()
    expect(client.deliveryHealth()).toMatchObject({
      pending: 3,
      coalesced: 1,
      failed: 100,
      lastFailure: { type: "WorkflowEventValidationError" },
    })
    expect(Object.keys(client.deliveryHealth()).sort()).toEqual([
      "coalesced",
      "dropped",
      "failed",
      "lastFailure",
      "pending",
      "pendingProgress",
    ])
    release()
    await expect(client.shutdown()).rejects.toMatchObject({
      failureCount: 100,
      omittedFailureCount: 80,
      failures: { length: 20 },
    })
    expect(events.filter((event) => event.type === "progress")).toMatchObject([
      { completed: 2 },
    ])
    expect(client.deliveryHealth().failed).toBe(100)
  })

  it("bounds critical overload and replacement state across many handles", async () => {
    const { client, release } = blockedClient({ progress: "latest" })
    // 800 starts + 400 terminals exceed the 1,000-entry critical limit even
    // without progress. More rejected submissions only repeat expensive error
    // construction; this is a capacity invariant, not a throughput benchmark.
    pipe(
      Array.range(0, 799),
      Array.forEach((index) => {
        const flow = client.workflow("many")
        flow.progress({ completed: 1 })
        if (index % 2 === 0) {
          flow.done()
        }
      }),
    )
    const health = client.deliveryHealth()
    expect(health.pending).toBe(1000)
    expect(health.pendingProgress).toBeGreaterThan(0)
    expect(health.pendingProgress).toBeLessThanOrEqual(900)
    expect(health.dropped).toBeGreaterThan(0)
    release()
    await expect(client.shutdown()).rejects.toMatchObject({
      failureCount: health.dropped,
      omittedFailureCount: health.dropped - 20,
      failures: { length: 20 },
    })
    expect(client.deliveryHealth()).toMatchObject({
      pending: 0,
      pendingProgress: 0,
    })
  }, 15_000)

  it("does not coalesce business reports or inherit their values into the final result", async () => {
    const { client, events, release } = blockedClient({ progress: "latest" })
    const flow = client.workflow("reports")
    flow.report({ saved: 1, skipped: 1 })
    flow.report({ saved: 2 })
    flow.done()
    release()
    await client.shutdown()
    expect(events.map((event) => event.type)).toEqual([
      "started",
      "report",
      "report",
      "completed",
    ])
    expect(events[2]).toMatchObject({ result: { saved: 2 } })
    expect(events[3]).not.toHaveProperty("result")
  })
})
