import { afterEach, describe, expect, it, vi } from "vitest"
import { createFlowmark } from "../src/browser/index.js"
import { FlowmarkConfigError } from "../src/errors/index.js"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("browser client", () => {
  it("reports terminal HTTP 409 without retrying or replacing the application return", async () => {
    vi.stubGlobal("location", { origin: "https://customer.example" })
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          { accepted: false, disposition: "ignored" },
          { status: 202 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json(
          { accepted: false, disposition: "conflict" },
          { status: 409 },
        ),
      )
    vi.stubGlobal("fetch", fetcher)
    const diagnostic = vi.fn()
    const client = createFlowmark({ onInstrumentationError: diagnostic })
    const flow = client.workflow("browser.callback", { id: "already-finished" })
    flow.done()
    await expect(client.flush()).rejects.toMatchObject({
      _tag: "FlowmarkDeliveryError",
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(diagnostic).toHaveBeenCalledOnce()
    expect(diagnostic.mock.calls[0]?.[1]).toMatchObject({ type: "completed" })
    await expect(
      flow.operation("application-work", () => Promise.resolve(42)),
    ).resolves.toBe(42)
    await client.shutdown()
  })

  it("can be imported and configured during SSR without accessing browser globals", async () => {
    vi.stubGlobal("location", undefined)
    const client = createFlowmark()
    const definition = client.defineWorkflow<
      Record<never, never>,
      { imported: number }
    >("ssr")
    expect(() => definition.start()).toThrow(FlowmarkConfigError)
    await client.flush()
    expect(() => client.workflow("ssr")).toThrow(FlowmarkConfigError)
    await client.shutdown()
  })

  it("sends ordered events only to the same-origin proxy, never with credentials from server env", async () => {
    vi.stubGlobal("location", { origin: "https://customer.example" })
    vi.stubEnv("FLOWMARK_API_KEY", "must-not-be-sent-from-browser")
    vi.stubEnv("FLOWMARK_API_URL", "https://flowmark.example")
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 202 }),
    )
    vi.stubGlobal("fetch", fetcher)
    const client = createFlowmark()
    const flow = client.workflow("browser.test", {
      correlationId: "browser-request-123",
      parentRunId: "upstream-run",
    })
    expect(flow.runId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    flow.step("saved")
    flow.done({ outcome: "partial" })
    await client.shutdown()
    expect(fetcher).toHaveBeenCalledTimes(3)
    const types: string[] = []
    const runIds = new Set<string>()
    for (const [url, options] of fetcher.mock.calls) {
      expect(url.toString()).toBe("https://customer.example/api/flowmark")
      expect(options).toMatchObject({
        credentials: "same-origin",
        mode: "same-origin",
        keepalive: true,
      })
      expect(new Headers(options?.headers).has("authorization")).toBe(false)
      const text = await new Response(options?.body).text()
      expect(text).not.toContain("must-not-be-sent-from-browser")
      const envelope = JSON.parse(text)
      types.push(envelope.event.type)
      runIds.add(envelope.event.runId)
    }
    expect(types).toEqual(["started", "step", "completed"])
    expect(
      JSON.parse(await new Response(fetcher.mock.calls[2]?.[1]?.body).text())
        .event.outcome,
    ).toBe("partial")
    expect(runIds.size).toBe(1)
    const started = JSON.parse(
      await new Response(fetcher.mock.calls[0]?.[1]?.body).text(),
    ).event
    expect(started).toMatchObject({
      runId: flow.runId,
      correlationId: "browser-request-123",
      parentRunId: "upstream-run",
    })
    expect(() => client.workflow("closed")).toThrow(FlowmarkConfigError)
  })

  it.each([
    "https://other.example/events",
    "//other.example/events",
    "/\\other.example",
    "relative",
    "/proxy?key=value",
  ])("rejects unsafe proxy paths: %s", (proxyPath) => {
    vi.stubGlobal("location", { origin: "https://customer.example" })
    expect(() => createFlowmark({ proxyPath }).workflow("test")).toThrow(
      FlowmarkConfigError,
    )
  })

  it("reports rejected proxy delivery without breaking UI markers", async () => {
    vi.stubGlobal("location", { origin: "https://customer.example" })
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 403 }),
    )
    vi.stubGlobal("fetch", fetcher)
    const onInstrumentationError = vi.fn()
    const client = createFlowmark({ onInstrumentationError })
    expect(() => client.workflow("denied").done()).not.toThrow()
    await expect(client.shutdown()).rejects.toThrow()
    expect(onInstrumentationError).toHaveBeenCalledTimes(2)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it("sends direct telemetry with only the public key and without cookies", async () => {
    vi.stubGlobal("location", { origin: "http://localhost:5173" })
    vi.stubEnv("FLOWMARK_API_KEY", "server-secret-must-not-leak")
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 202 }),
    )
    vi.stubGlobal("fetch", fetcher)
    const client = createFlowmark({
      publicKey: "fm_browser_public",
      apiUrl: "http://localhost:3003",
    })
    const flow = client.workflow("checkout")
    flow.step("saved")
    flow.done()
    await client.shutdown()
    expect(fetcher).toHaveBeenCalledTimes(3)
    for (const [url, options] of fetcher.mock.calls) {
      expect(url.toString()).toBe("http://localhost:3003/v1/browser-events")
      expect(options).toMatchObject({
        credentials: "omit",
        mode: "cors",
        keepalive: true,
      })
      expect(new Headers(options?.headers).get("authorization")).toBe(
        "Bearer fm_browser_public",
      )
      expect(new Headers(options?.headers).get("traceparent")).toMatch(
        /^00-[\da-f]{32}-[\da-f]{16}-0[01]$/,
      )
      expect(new Headers(options?.headers).has("b3")).toBe(true)
      expect(await new Response(options?.body).text()).not.toContain(
        "server-secret-must-not-leak",
      )
    }
  })

  it.each([
    { publicKey: "fm_browser_public" },
    { apiUrl: "http://localhost:3003" },
    { publicKey: "", apiUrl: "http://localhost:3003" },
    { publicKey: "fm_browser_public", apiUrl: "http://remote.example" },
    { publicKey: "fm_browser_public", apiUrl: "not-a-url" },
    {
      publicKey: "fm_browser_public",
      apiUrl: "http://localhost:3003",
      proxyPath: "/api/flowmark",
    },
  ])("rejects invalid or ambiguous direct settings: %j", (config) => {
    vi.stubGlobal("location", { origin: "http://localhost:5173" })
    expect(() => createFlowmark(config).workflow("test")).toThrow(
      FlowmarkConfigError,
    )
  })
})
