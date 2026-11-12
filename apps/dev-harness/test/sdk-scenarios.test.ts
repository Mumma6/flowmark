import { describe, expect, it, vi } from "vitest"
import { MemoryTransport, workflow } from "@flowmarkdev/node"
import { runScenario, scenarioIds, scenarios } from "../lib/sdk-scenarios"

describe("SDK scenario composition", () => {
  it("keeps the catalog complete and ordered", () => {
    expect(scenarios.map((scenario) => scenario.id)).toEqual(scenarioIds)
  })
  it.each(scenarioIds)(
    "%s preserves lifecycle order and scenario evidence",
    async (id) => {
      const transport = new MemoryTransport()
      const client = {
        workflow: (name: string, options?: Parameters<typeof workflow>[1]) =>
          workflow(name, {
            ...options,
            id: options?.id ?? crypto.randomUUID(),
            transport,
          }),
      }
      const result = await runScenario(client, id, "browser")
      await vi.waitFor(() =>
        expect(
          transport.events.some(
            (event) => event.type === "completed" || event.type === "failed",
          ),
        ).toBe(true),
      )
      const events = transport.events
      expect(events[0]?.type).toBe("started")
      expect(result.runs[0]?.name).toBe(`browser.sdk.browser.${id}`)
      if (id === "progress") {
        expect(
          events.flatMap((event) =>
            event.type === "progress" ? [event.completed] : [],
          ),
        ).toEqual([0, 1, 2, 3])
      }
      if (id === "deferred-completion") {
        expect(events.at(-1)).toMatchObject({
          type: "completed",
          result: { deferred: true },
        })
        expect(
          events.filter((event) => event.type === "operation_completed"),
        ).toHaveLength(2)
      }
      if (id === "operation-failure") {
        expect(events.map((event) => event.type)).toEqual([
          "started",
          "operation_started",
          "operation_failed",
          "error",
          "completed",
        ])
      }
      if (id === "terminal-failure") {
        expect(events.at(-1)?.type).toBe("failed")
        expect(events.some((event) => event.type === "completed")).toBe(false)
      }
      if (id === "correlation") {
        expect(result.runs).toHaveLength(2)
        expect(
          events.filter((event) => event.type === "started")[1],
        ).toMatchObject({
          parentRunId: result.runs[0]?.runId,
          correlationId: result.correlationId,
        })
      } else {
        expect(new Set(events.map((event) => event.runId)).size).toBe(1)
      }
      if (id === "continue") {
        expect(
          events
            .filter((event) => event.type === "step")
            .map((event) => event.step),
        ).toEqual(["draft-started", "battle-claimed"])
      }
    },
  )
})
