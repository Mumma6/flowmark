import { Deferred, Effect, Layer } from "effect"
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
  it("coalesces 10,000 absolute snapshots and preserves the final progress, report, operation pair and terminal", async () => {
    const { client, events, release } = blockedClient({ progress: "latest" })
    const flow = client.workflow("bulk")
    const operation = flow.operation("import")
    for (let completed = 1; completed <= 10_000; completed++) {
      flow.progress({ completed, total: 10_000, unit: "records" })
    }
    expect(client.deliveryHealth()).toMatchObject({
      pending: 3,
      pendingProgress: 1,
      coalesced: 9999,
      dropped: 0,
      failed: 0,
    })
    flow.report({ saved: 10_000 })
    flow.done({ result: { saved: 10_000 } })
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
    expect(events[2]).toMatchObject({ completed: 10_000, total: 10_000 })
    expect(events[5]).toMatchObject({ result: { saved: 10_000 } })
    expect(client.deliveryHealth()).toMatchObject({
      pending: 0,
      pendingProgress: 0,
      coalesced: 9999,
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
    for (let completed = 1; completed <= 10_000; completed++) {
      flow.progress({ completed })
    }
    flow.report({ saved: 10_000 })
    const operation = flow.operation("commit")
    operation.done()
    flow.done({ result: { saved: 10_000 } })
    expect(client.deliveryHealth()).toMatchObject({
      pending: 903,
      coalesced: 0,
      dropped: 9102,
    })
    release()
    await expect(client.flush()).rejects.toMatchObject({
      failureCount: 9102,
      omittedFailureCount: 9082,
      failures: { length: 20 },
    })
    expect(diagnostics()).toBe(9102)
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
    expect(client.deliveryHealth()).toMatchObject({ pending: 0, dropped: 9102 })
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
    for (let index = 0; index < 2000; index++) {
      const flow = client.workflow("many")
      flow.progress({ completed: 1 })
      if (index % 2 === 0) {
        flow.done()
      }
    }
    const health = client.deliveryHealth()
    expect(health.pending).toBe(1000)
    expect(health.pendingProgress).toBeGreaterThan(0)
    expect(health.pendingProgress).toBeLessThanOrEqual(900)
    expect(health.dropped).toBeGreaterThan(0)
    release()
    await expect(client.shutdown()).rejects.toMatchObject({
      failureCount: health.dropped,
      failures: { length: 20 },
    })
    expect(client.deliveryHealth().pendingProgress).toBe(0)
  })

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
