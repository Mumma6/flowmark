import { describe, expect, it, vi } from "vitest"
import { MemoryTransport, workflow } from "@flowmark/node"
import { runBusinessScenario } from "../lib/business-scenarios"
import { businessScenarios, ExecutionSchema } from "../lib/operations-catalog"
import { Schema } from "effect"

describe("operations application scenarios", () => {
  for (const scenario of businessScenarios) {
    it(`${scenario.id} records the application's actual outcome`, async () => {
      const transport = new MemoryTransport()
      const client = {
        workflow: (name: string, options?: Parameters<typeof workflow>[1]) =>
          workflow(name, {
            ...options,
            id: options?.id ?? crypto.randomUUID(),
            transport,
          }),
      }
      const execution = await runBusinessScenario(client, scenario.id)
      expect(Schema.decodeUnknownSync(ExecutionSchema)(execution)).toEqual(
        execution,
      )
      await vi.waitFor(() =>
        expect(
          transport.events.some(
            (event) => event.type === "completed" || event.type === "failed",
          ),
        ).toBe(true),
      )
      const events = transport.events
      expect(new Set(events.map((event) => event.workflow))).toEqual(
        new Set([scenario.workflow]),
      )
      expect(events[0]).toMatchObject({
        type: "started",
        environment: "local",
        properties: { reference: execution.reference, synthetic: true },
      })
      const terminal = events.find(
        (event) => event.type === "completed" || event.type === "failed",
      )
      expect(terminal?.type).toBe(execution.status)
      if (execution.status === "completed") {
        expect(terminal).toMatchObject({ result: execution.result })
      } else {
        expect(events.some((event) => event.type === "completed")).toBe(false)
        expect(terminal).toMatchObject({
          failure: { retryable: true },
          result: execution.result,
        })
      }
      if (scenario.id === "invoices-rejected") {
        expect(execution.result).toEqual({ total: 5, imported: 3, skipped: 2 })
        expect(events.filter((event) => event.type === "error")).toHaveLength(2)
        expect(
          events.filter(
            (event) =>
              event.type === "step" && event.step === "invoice-rejected",
          ),
        ).toMatchObject([
          { properties: { invoiceRef: "INV-1003" } },
          { properties: { invoiceRef: "INV-1005" } },
        ])
      }
      if (scenario.id === "invoices-clean") {
        expect(execution.result).toEqual({ total: 5, imported: 5, skipped: 0 })
        expect(events.some((event) => event.type === "error")).toBe(false)
      }
      if (scenario.area === "inventory") {
        expect(
          events.filter((event) => event.type === "progress").at(-1),
        ).toMatchObject({
          completed: execution.result.updated,
          total: 12,
          unit: "products",
        })
      }
      if (scenario.id === "order-carrier-down") {
        expect(
          events.some(
            (event) => event.type === "step" && event.step === "stock-reserved",
          ),
        ).toBe(true)
        expect(
          events.some(
            (event) =>
              event.type === "step" && event.step === "ready-for-dispatch",
          ),
        ).toBe(false)
        expect(execution.result).toEqual({
          stockReserved: true,
          labelCreated: false,
        })
        expect(
          events.find((event) => event.type === "operation_failed"),
        ).toMatchObject({ operationName: "create-shipping-label" })
      }
    })
  }
})
