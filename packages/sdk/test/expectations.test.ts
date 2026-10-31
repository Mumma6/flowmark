import { Effect } from "effect"
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest"
import {
  createFlowmarkWithTransport,
  createFlowmark,
  type ExpectationReference,
} from "../src/index.js"
import type { WorkflowEvent } from "@flowmarkdev/core"
import { createFlowmark as browser } from "../src/browser/index.js"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
const setup = () => {
  const events: WorkflowEvent[] = []
  const errors = vi.fn()
  const client = createFlowmarkWithTransport({
    transport: {
      emit: (event) =>
        Effect.sync(() => {
          events.push(event)
        }),
    },
    onInstrumentationError: errors,
  })
  return { client, events, errors }
}
describe("expectation markers and client settlement lifecycle", () => {
  it("preserves run terminal/result, records settlement without starting another run and supports a fresh client", async () => {
    const { client, events } = setup()
    const flow = client
      .defineWorkflow<Record<never, never>, { submitted: number }, "submitted">(
        "booking",
      )
      .start()
    const ref = flow.expect("provider-response", {
      id: "confirmation",
      within: "5m",
    })
    expectTypeOf(ref).toEqualTypeOf<ExpectationReference>()
    flow.done({ outcome: "submitted", result: { submitted: 1 } })
    client.resolveExpectation(ref, {
      outcome: "no-availability",
      result: { reserved: 0 },
    })
    await client.shutdown()
    expect(events.map((e) => e.type)).toEqual([
      "started",
      "expectation_declared",
      "completed",
      "expectation_resolved",
    ])
    expect(events[1]).toMatchObject({
      withinMs: 300000,
      expectationId: "confirmation",
    })
    expect(events[2]).toMatchObject({
      outcome: "submitted",
      result: { submitted: 1 },
    })
    const fresh = setup()
    fresh.client.cancelExpectation(ref, { code: "BOOKING_CANCELLED" })
    await fresh.client.shutdown()
    expect(fresh.events.map((e) => e.type)).toEqual(["expectation_cancelled"])
  })
  it("diagnoses invalid durations, references and closed declarations without changing callback returns/errors", async () => {
    const { client, events, errors } = setup()
    const flow = client.workflow("booking")
    flow.expect("bad-duration", { id: "bad", within: "0s" })
    client.resolveExpectation({ version: 2 } as unknown as ExpectationReference)
    client.resolveExpectation(null as unknown as ExpectationReference)
    const original = new Error("application rejection")
    await expect(
      flow.operation("submit", () => Promise.reject(original)),
    ).rejects.toBe(original)
    expect(await flow.operation("work", () => Promise.resolve(42))).toBe(42)
    flow.done()
    flow.expect("closed", { id: "closed", within: "1m" })
    await expect(client.shutdown()).rejects.toMatchObject({
      _tag: "FlowmarkDeliveryError",
      failureCount: 4,
    })
    expect(errors).toHaveBeenCalledTimes(4)
    expect(events.some((e) => e.type === "expectation_declared")).toBe(false)
  })
  it("returns canonical direct browser references and refuses copied server references", async () => {
    vi.stubGlobal("location", { origin: "https://customer.example" })
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json(
        { accepted: true, capabilities: ["expectations-v1"] },
        { status: 202 },
      ),
    )
    vi.stubGlobal("fetch", fetcher)
    const errors = vi.fn(),
      client = browser({
        apiUrl: "http://localhost",
        publicKey: "fm_browser_synthetic",
        onInstrumentationError: errors,
      })
    const flow = client.workflow("booking")
    const ref = flow.expect("response", {
      id: "browser-confirmation",
      within: "5m",
    })
    expect(ref.workflow).toBe("browser.booking")
    await client.flush()
    client.resolveExpectation(ref)
    await client.flush()
    client.resolveExpectation({ ...ref, workflow: "booking" })
    await expect(client.shutdown()).rejects.toMatchObject({ failureCount: 1 })
    expect(errors).toHaveBeenCalledWith(
      expect.objectContaining({
        _tag: "FlowmarkExpectationError",
        reason: "source-forbidden",
      }),
      expect.anything(),
    )
    expect(fetcher).toHaveBeenCalledTimes(3)
  })
  it.each([false, true])(
    "fails capability acknowledgment or permanent limits without transport retries (limit=%s)",
    async (limit) => {
      const fetcher = vi.fn<typeof fetch>(async () =>
        limit
          ? Response.json(
              { code: "EXPECTATION_LIMIT_REACHED" },
              { status: 429 },
            )
          : Response.json({ accepted: true }, { status: 202 }),
      )
      vi.stubGlobal("fetch", fetcher)
      const client = createFlowmark({
        apiUrl: "http://localhost",
        apiKey: "synthetic",
        onInstrumentationError: () => {},
      })
      client.resolveExpectation({
        version: 1,
        workflow: "booking",
        runId: "existing",
        expectationId: "confirmation",
      })
      await expect(client.shutdown()).rejects.toMatchObject({ failureCount: 1 })
      expect(fetcher).toHaveBeenCalledTimes(1)
      expect(
        new Headers(fetcher.mock.calls[0]?.[1]?.headers).get(
          "x-flowmark-expectations",
        ),
      ).toBe("v1")
    },
  )
  it("blocks generic-proxy expectations locally while preserving ordinary telemetry", async () => {
    vi.stubGlobal("location", { origin: "https://customer.example" })
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 202 }),
    )
    vi.stubGlobal("fetch", fetcher)
    const client = browser({ onInstrumentationError: () => {} }),
      flow = client.workflow("booking")
    const ref = flow.expect("response", { id: "confirmation", within: "5m" })
    client.cancelExpectation(ref, { code: "CANCELLED" })
    flow.done()
    await expect(client.shutdown()).rejects.toMatchObject({ failureCount: 2 })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
