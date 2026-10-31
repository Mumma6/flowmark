import { afterEach, describe, expect, it, vi } from "vitest"

const callbacks = vi.hoisted(() => [] as Array<() => Promise<void>>)
vi.mock("next/server", () => ({
  after: vi.fn((callback: () => Promise<void>) => {
    callbacks.push(callback)
  }),
}))

import { after } from "next/server"
import { createFlowmark, defineConfig } from "../src/adapters/next.js"

afterEach(() => {
  callbacks.length = 0
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("Next.js integration", () => {
  it("sends only safely mapped callback failure fields and preserves recovery", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 202 }),
    )
    vi.stubGlobal("fetch", fetcher)
    const client = createFlowmark({ apiKey: "key", apiUrl: "http://localhost" })
    const flow = client.workflow("crm.safe-error")
    const original = new Error("RUNTIME_SYNTHETIC_SECRET_008")
    await expect(
      flow.operation("request", () => Promise.reject(original), {
        mapError: () => ({
          code: "CRM_UNAVAILABLE",
          message: "CRM unavailable",
          retryable: true,
        }),
      }),
    ).rejects.toBe(original)
    flow.done({ result: { imported: 0 } })
    await callbacks[0]()
    const envelopes = await Promise.all(
      fetcher.mock.calls.map(async ([, options]) =>
        JSON.parse(await new Response(options?.body).text()),
      ),
    )
    expect(JSON.stringify(envelopes)).not.toContain(
      "RUNTIME_SYNTHETIC_SECRET_008",
    )
    expect(
      envelopes.find((item) => item.event.type === "operation_failed")?.event
        .failure,
    ).toEqual({
      code: "CRM_UNAVAILABLE",
      message: "CRM unavailable",
      retryable: true,
    })
    expect(envelopes.at(-1)?.event.type).toBe("completed")
  })

  it("drains opt-in progress in order and reports final request-local health", async () => {
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const fetcher = vi.fn<typeof fetch>(async () => {
      await gate
      return new Response(null, { status: 202 })
    })
    vi.stubGlobal("fetch", fetcher)
    const onDeliveryHealth = vi.fn()
    const client = createFlowmark(
      defineConfig({
        apiKey: "key",
        apiUrl: "http://localhost",
        delivery: { progress: "latest" },
        onDeliveryHealth,
      }),
    )
    const flow = client.workflow("bulk.request")
    for (let completed = 1; completed <= 1000; completed++) {
      flow.progress({ completed })
    }
    flow.done({ result: { saved: 1000 } })
    expect(client).not.toHaveProperty("flush")
    expect(onDeliveryHealth).not.toHaveBeenCalled()
    release()
    await callbacks[0]()
    expect(onDeliveryHealth).toHaveBeenCalledWith({
      pending: 0,
      pendingProgress: 0,
      coalesced: 999,
      dropped: 0,
      failed: 0,
      lastFailure: null,
    })
    const events = await Promise.all(
      fetcher.mock.calls.map(
        async ([, options]) =>
          JSON.parse(await new Response(options?.body).text()).event,
      ),
    )
    expect(events.map((event) => event.type)).toEqual([
      "started",
      "progress",
      "completed",
    ])
    expect(events[1].completed).toBe(1000)
    expect(events[2].result).toEqual({ saved: 1000 })
  })

  it("reports bounded final health after failures and contains a throwing health callback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => new Response(null, { status: 401 })),
    )
    vi.spyOn(console, "error").mockImplementation(() => {})
    const onDeliveryHealth = vi.fn(() => {
      throw new Error("observer failed")
    })
    const client = createFlowmark({
      apiKey: "key",
      apiUrl: "http://localhost",
      onDeliveryHealth,
      onInstrumentationError: vi.fn(),
    })
    client.workflow("failure").done()
    await expect(callbacks[0]()).resolves.toBeUndefined()
    expect(onDeliveryHealth).toHaveBeenCalledWith(
      expect.objectContaining({
        pending: 0,
        failed: 2,
        lastFailure: { type: "WorkflowTransportError" },
      }),
    )
  })

  it("automatically drains independent workflows after each request", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 202 }),
    )
    vi.stubGlobal("fetch", fetcher)
    const flowmark = createFlowmark(
      defineConfig({
        apiKey: "key",
        apiUrl: "http://localhost",
      }),
    )
    const definition = flowmark.defineWorkflow<
      Record<never, never>,
      { saved: number }
    >("todo.add")
    expect(callbacks).toHaveLength(0)
    const flow = definition.start()
    flow.step("saved")
    flow.report({ saved: 1 })
    flow.done({ outcome: "no-availability" })
    flowmark.workflow("todo.complete").done()
    expect(callbacks).toHaveLength(2)
    await Promise.all(callbacks.map((callback) => callback()))
    expect(fetcher).toHaveBeenCalledTimes(6)
    const events = await Promise.all(
      fetcher.mock.calls.map(
        async ([, options]) =>
          JSON.parse(await new Response(options?.body).text()).event,
      ),
    )
    expect(events.find((event) => event.type === "report")).toMatchObject({
      result: { saved: 1 },
    })
    expect(
      events.find((event) => event.outcome === "no-availability"),
    ).toMatchObject({ type: "completed", workflow: "todo.add" })
  })

  it.each([401, 409])(
    "logs HTTP %s delivery failure without rejecting Next's after callback",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>(async () => new Response(null, { status })),
      )
      const log = vi.spyOn(console, "error").mockImplementation(() => {})
      const flowmark = createFlowmark({
        apiKey: "key",
        apiUrl: "http://localhost",
        onInstrumentationError: vi.fn(),
      })
      flowmark.workflow("todo.add").done()
      await expect(callbacks[0]()).resolves.toBeUndefined()
      expect(log).toHaveBeenCalledOnce()
    },
  )

  it("rejects unsupported Next.js contexts before initializing the client", () => {
    vi.mocked(after).mockImplementationOnce(() => {
      throw new Error("after() is unavailable in this context")
    })
    const flowmark = createFlowmark({ apiKey: "" })
    expect(() => flowmark.workflow("unsupported")).toThrow(
      "after() is unavailable",
    )
    expect(callbacks).toHaveLength(0)
  })
})
