import { Effect, Layer } from "effect"
import { describe, expect, expectTypeOf, it } from "vitest"
import { MemoryTransport, type FlowmarkClient } from "../src/index.js"
import type {
  WorkflowDefinition as NodeDefinition,
  TypedFlow as NodeFlow,
} from "../src/index.js"
import type {
  WorkflowDefinition as NextDefinition,
  TypedFlow as NextFlow,
} from "../src/adapters/next.js"
import type {
  WorkflowDefinition as BrowserDefinition,
  TypedFlow as BrowserFlow,
} from "../src/browser/index.js"
import { makeClient } from "../src/client/runtime.js"
import { WorkflowTransport } from "../src/features/delivery/ports/workflow-transport.js"

interface ImportContext {
  batchId: string
  provider?: "crm-a" | "crm-b"
}
interface ImportResult {
  imported: number
  reasons?: { invalid: number }
  items?: readonly string[]
}

// Compiled by the SDK typecheck; never executed, so invalid calls emit no telemetry.
export function compileTimeContract(client: FlowmarkClient) {
  expectTypeOf<NodeDefinition<ImportContext, ImportResult>>().toEqualTypeOf<
    NextDefinition<ImportContext, ImportResult>
  >()
  expectTypeOf<NodeFlow<ImportContext, ImportResult>>().toEqualTypeOf<
    BrowserFlow<ImportContext, ImportResult>
  >()
  expectTypeOf<NextFlow<ImportContext, ImportResult>>().toEqualTypeOf<
    NodeFlow<ImportContext, ImportResult>
  >()
  expectTypeOf<BrowserDefinition<ImportContext, ImportResult>>().toEqualTypeOf<
    NodeDefinition<ImportContext, ImportResult>
  >()
  const definition = client.defineWorkflow<
    ImportContext,
    ImportResult,
    "complete" | "partial"
  >("import")
  // @ts-expect-error required context is missing
  definition.start()
  // @ts-expect-error required context property is missing
  definition.start({ properties: {} })
  // @ts-expect-error invalid context category
  definition.start({ properties: { batchId: "42", provider: "unknown" } })
  const flow = definition.start({ properties: { batchId: "42" } })
  flow.report({})
  flow.report({ imported: 20 })
  flow.done()
  flow.done({ outcome: "partial", result: { imported: 30, items: ["a"] } })
  flow.fail({ code: "TIMEOUT", result: { imported: 20 } })
  flow.setProperties({ provider: "crm-b" })
  flow.step("checkpoint", { properties: { independent: true } })
  // @ts-expect-error count must be numeric
  flow.report({ imported: "20" })
  // @ts-expect-error terminal result must contain required fields
  flow.done({ result: {} })
  // @ts-expect-error unsupported outcome
  flow.fail({ code: "TIMEOUT", outcome: "unknown" })
  // @ts-expect-error context amendments are typed
  flow.setProperties({ batchId: 20 })
  // @ts-expect-error partial reports are shallow
  flow.report({ reasons: {} })
  expectTypeOf(
    flow.operation("fetch", () => Promise.resolve(42)),
  ).toEqualTypeOf<Promise<number>>()
  client
    .defineWorkflow<{ optional?: string }, { ok: boolean }>("optional")
    .start()
  client
    .defineWorkflow<
      Record<never, never>,
      { nested: { value: string | null }; tags: string[] }
    >("nested")
    .start()
    .report({ nested: { value: null } })
  const invalidDate = client.defineWorkflow<
    { date: Date },
    Record<never, never>
  >("invalid")
  // @ts-expect-error dates are not JSON values
  invalidDate.start({ properties: { date: new Date() } })
  // @ts-expect-error functions are not JSON values
  flow.report({ reasons: () => 1 })
}

describe("typed workflow definitions", () => {
  it("is inert, reuses the client, preserves continuation and emits ordinary wire payloads", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const transport = new MemoryTransport()
        const client = makeClient(Layer.succeed(WorkflowTransport, transport))
        const definition = client.defineWorkflow<
          ImportContext,
          ImportResult,
          "partial"
        >("import")
        expect(transport.events).toEqual([])
        const first = definition.start({ properties: { batchId: "42" } })
        const second = definition.start({ properties: { batchId: "43" } })
        expect(second.runId).not.toBe(first.runId)
        const continued = definition.start({
          id: first.runId,
          properties: { batchId: "42" },
        })
        expect(continued.runId).toBe(first.runId)
        first.report({ imported: 20 })
        first.setProperties({ provider: "crm-a" })
        const result = yield* Effect.promise(() =>
          first.operation("save", () => Promise.resolve("saved")),
        )
        expect(result).toBe("saved")
        const cause = new Error("original")
        const failed = yield* Effect.tryPromise({
          try: () => first.operation("fail", () => Promise.reject(cause)),
          catch: (error) => error,
        }).pipe(Effect.flip)
        expect(failed).toBe(cause)
        first.done({ outcome: "partial", result: { imported: 30 } })
        const plain = client.workflow("import", {
          properties: { batchId: "42" },
        })
        plain.report({ imported: 20 })
        plain.done({ outcome: "partial", result: { imported: 30 } })
        yield* Effect.promise(() => client.flush())
        const payloads = (runId: string) =>
          transport.events
            .filter(
              (event) =>
                event.runId === runId &&
                (event.type === "report" || event.type === "completed"),
            )
            .map((event) => ({
              type: event.type,
              workflow: event.workflow,
              ...(event.type === "report" || event.type === "completed"
                ? { result: event.result }
                : {}),
              ...("outcome" in event ? { outcome: event.outcome } : {}),
            }))
        expect(payloads(first.runId)).toEqual(payloads(plain.runId))
        yield* Effect.promise(() => client.shutdown())
        expect(() =>
          definition.start({ properties: { batchId: "44" } }),
        ).toThrow()
      }),
    ))
})
