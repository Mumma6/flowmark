import { Effect, Layer } from "effect"
import { describe, expect, it } from "vitest"
import { makeOperations } from "../src/workflows/operations.js"
import { WorkflowRuns } from "../src/workflows/run-lifecycle.js"
import { WorkflowEvents } from "../src/workflows/workflow-events.js"
import type { WorkflowEventData } from "../src/workflows/events.js"

describe("workflow run service", () => {
  it("isolates state for reused run IDs with an injected event recorder", async () => {
    const events: {
      workflow: string
      runId: string
      event: WorkflowEventData
    }[] = []
    const recorder = Layer.succeed(WorkflowEvents, {
      forRun: (workflow, runId) =>
        Effect.succeed({
          record: (event) =>
            Effect.sync(() => {
              events.push({ workflow, runId, event })
            }),
        }),
    })
    const program = Effect.gen(function* () {
      const runs = yield* WorkflowRuns
      const first = yield* runs.start("first", { id: "same-id" })
      const second = yield* runs.start("second", { id: "same-id" })
      const operation = yield* makeOperations(first)("load")
      yield* first.done({ result: { rows: 1 } })
      expect(yield* first.isOpen).toBe(false)
      expect(yield* first.isFinished).toBe(false)
      expect(yield* second.isOpen).toBe(true)
      yield* second.fail({ code: "application-failure" })
      expect(yield* first.isFinished).toBe(false)
      yield* operation.done
      yield* operation.fail({ code: "ignored" })
      expect(yield* first.isFinished).toBe(true)
    }).pipe(Effect.provide(WorkflowRuns.layer.pipe(Layer.provide(recorder))))

    expect(events).toHaveLength(0)
    await Effect.runPromise(program)
    expect(
      events
        .filter(({ workflow }) => workflow === "first")
        .map(({ event }) => event.type),
    ).toEqual([
      "started",
      "operation_started",
      "operation_completed",
      "completed",
    ])
    expect(
      events
        .filter(({ workflow }) => workflow === "second")
        .map(({ event }) => event.type),
    ).toEqual(["started", "failed"])
    expect(events.at(-1)?.event).toEqual({
      type: "completed",
      result: { rows: 1 },
    })
    expect(events.every(({ runId }) => runId === "same-id")).toBe(true)
  })
})
