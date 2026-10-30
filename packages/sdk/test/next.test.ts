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
    const flow = flowmark.workflow("todo.add")
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

  it("logs failed delivery without rejecting Next's after callback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => new Response(null, { status: 401 })),
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
  })

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
