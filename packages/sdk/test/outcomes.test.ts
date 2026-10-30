import { Effect } from "effect"
import { describe, expect, it, vi } from "vitest"
import {
  MemoryTransport,
  workflow,
  type WorkflowDoneOptions,
  type WorkflowFailOptions,
} from "../src/index.js"
import type { WorkflowDoneOptions as NextDone } from "../src/adapters/next.js"
import type { FlowmarkClient } from "../src/browser/index.js"

describe("terminal business outcomes", () => {
  it("retains outcome while completion waits for open operations", async () => {
    const transport = new MemoryTransport()
    const flow = workflow("import", { id: "synthetic-partial", transport })
    const operation = flow.operation("page")
    const options = {
      outcome: "partial",
      result: { imported: 80 },
    } satisfies WorkflowDoneOptions & NextDone
    flow.done(options)
    operation.done()
    await vi.waitFor(() => expect(transport.events).toHaveLength(4))
    expect(transport.events.at(-1)).toMatchObject({
      type: "completed",
      ...options,
    })
  })
  it("keeps outcome outside the failure object and preserves arbitrary result JSON", async () => {
    const transport = new MemoryTransport()
    const flow = workflow("sync", { id: "synthetic-failed", transport })
    const options = {
      code: "TIMEOUT",
      outcome: "partial",
      result: { updated: 80, outcome: "custom-result-value" },
    } satisfies WorkflowFailOptions
    flow.fail(options)
    await vi.waitFor(() => expect(transport.events).toHaveLength(2))
    expect(transport.events.at(-1)).toMatchObject({
      type: "failed",
      outcome: "partial",
      failure: { code: "TIMEOUT" },
      result: options.result,
    })
    expect(transport.events.at(-1)).toHaveProperty("failure", {
      code: "TIMEOUT",
    })
  })
  it("diagnoses an invalid outcome without interrupting business work", async () => {
    const diagnostic = vi.fn()
    const transport = new MemoryTransport()
    const flow = workflow("invalid", {
      id: "synthetic-invalid",
      transport,
      onInstrumentationError: diagnostic,
    })
    expect(() => flow.done({ outcome: "INVALID" })).not.toThrow()
    await vi.waitFor(() => expect(diagnostic).toHaveBeenCalledOnce())
    expect(transport.events.map(({ type }) => type)).toEqual(["started"])
  })
  it("accepts outcome-only completion through browser's shared public Flow type", () => {
    // Compile-time reference: browser and Next expose the same optional field.
    type BrowserFlow = ReturnType<FlowmarkClient["workflow"]>
    const options: Parameters<BrowserFlow["done"]>[0] = {
      outcome: "no-availability",
    }
    return Effect.runPromise(
      Effect.sync(() =>
        expect(options).toEqual({ outcome: "no-availability" }),
      ),
    )
  })
})
