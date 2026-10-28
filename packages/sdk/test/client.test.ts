import { afterEach, describe, expect, it, vi } from "vitest"
import { inspect } from "node:util"
import { createFlowmark, FlowmarkConfigError } from "../src/index.js"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("configured HTTP client", () => {
  it("delivers authenticated events in order and generates separate run IDs", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 202 }),
    )
    vi.stubGlobal("fetch", fetcher)
    const client = createFlowmark({
      apiKey: "write-key",
      apiUrl: "http://localhost:3003",
    })
    const first = client.workflow("todo.add", {
      properties: { todoId: "todo-1" },
    })
    first.step("saved")
    first.done()
    client.workflow("todo.add").done()
    await client.flush()
    expect(fetcher).toHaveBeenCalledTimes(5)
    const envelopes = await Promise.all(
      fetcher.mock.calls.map(async (call) => {
        const options = call[1]!
        expect(options.headers).toMatchObject({
          authorization: "Bearer write-key",
        })
        return JSON.parse(await new Response(options.body).text())
      }),
    )
    const firstRun = envelopes.filter(
      (entry) => entry.event.runId === envelopes[0].event.runId,
    )
    expect(firstRun.map((entry) => entry.event.type)).toEqual([
      "started",
      "step",
      "completed",
    ])
    expect(new Set(envelopes.map((entry) => entry.event.runId)).size).toBe(2)
    expect(new Set(envelopes.map((entry) => entry.eventId)).size).toBe(5)
    await client.shutdown()
    expect(() => client.workflow("closed")).toThrow(FlowmarkConfigError)
  })

  it("applies client environment defaults and allows per-run overrides", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 202 }),
    )
    vi.stubGlobal("fetch", fetcher)
    const client = createFlowmark({
      apiKey: "write-key",
      apiUrl: "http://localhost:3003",
      environment: "production",
      release: "release-default",
    })
    const overridden = client.workflow("checkout", {
      environment: "staging",
      release: "release-override",
    })
    overridden.done()
    client.workflow("checkout").done()
    await client.flush()
    const events = await Promise.all(
      fetcher.mock.calls.map(
        async (call) =>
          JSON.parse(await new Response(call[1]?.body).text()).event,
      ),
    )
    const starts = events.filter((event) => event.type === "started")
    expect(starts).toHaveLength(2)
    expect(starts).toContainEqual(
      expect.objectContaining({
        environment: "staging",
        release: "release-override",
      }),
    )
    expect(starts).toContainEqual(
      expect.objectContaining({
        environment: "production",
        release: "release-default",
      }),
    )
    await client.shutdown()
  })

  it("reports invalid progress values instead of coercing them", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 202 }),
    )
    const onInstrumentationError = vi.fn()
    vi.stubGlobal("fetch", fetcher)
    const client = createFlowmark({
      apiKey: "write-key",
      apiUrl: "http://localhost:3003",
      onInstrumentationError,
    })
    const flow = client.workflow("import")
    flow.progress({ completed: 5, total: 4, unit: "rows" })
    flow.done()
    await expect(client.flush()).rejects.toThrow()
    expect(onInstrumentationError).toHaveBeenCalledOnce()
    expect(onInstrumentationError.mock.calls[0]?.[0]).toMatchObject({
      _tag: "WorkflowEventValidationError",
    })
    const types = await Promise.all(
      fetcher.mock.calls.map(
        async ([, options]) =>
          JSON.parse(await new Response(options?.body).text()).event.type,
      ),
    )
    expect(types).toEqual(["started", "completed"])
    await client.shutdown()
  })

  it("retries transient failures with the same idempotency key", async () => {
    const bodies: string[] = []
    const fetcher = vi.fn(async (_url: string, options: RequestInit) => {
      bodies.push(await new Response(options.body).text())
      return new Response(null, { status: bodies.length < 3 ? 503 : 202 })
    })
    vi.stubGlobal("fetch", fetcher)
    const client = createFlowmark({ apiKey: "key", apiUrl: "http://localhost" })
    client.workflow("test")
    await client.flush()
    expect(bodies).toHaveLength(3)
    expect(new Set(bodies).size).toBe(1)
    await client.shutdown()
  })

  it("does not retry authentication errors and reports failed delivery at flush", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 401 }))
    vi.stubGlobal("fetch", fetcher)
    const onInstrumentationError = vi.fn()
    const client = createFlowmark({
      apiKey: "bad-key",
      apiUrl: "http://localhost",
      onInstrumentationError,
    })
    expect(() => client.workflow("test").done()).not.toThrow()
    await expect(client.flush()).rejects.toThrow()
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(onInstrumentationError).toHaveBeenCalledTimes(2)
    await client.shutdown()
  })

  it("bounds network retries and preserves application behavior", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("offline")
    })
    vi.stubGlobal("fetch", fetcher)
    const client = createFlowmark({
      apiKey: "key",
      apiUrl: "http://localhost",
      onInstrumentationError: vi.fn(),
    })
    client.workflow("test")
    await expect(client.shutdown()).rejects.toThrow()
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it("rejects missing credentials and insecure non-local endpoints", () => {
    expect(() =>
      createFlowmark({ apiKey: "", apiUrl: "http://localhost" }),
    ).toThrow(FlowmarkConfigError)
    expect(() =>
      createFlowmark({ apiKey: "key", apiUrl: "http://example.com" }),
    ).toThrow(FlowmarkConfigError)
  })

  it("explains missing server credentials without supplying a demo fallback", () => {
    vi.stubEnv("FLOWMARK_API_KEY", "")
    expect(() => createFlowmark()).toThrow(
      "Set FLOWMARK_API_KEY in the server environment",
    )
    expect(() => createFlowmark()).toThrow(FlowmarkConfigError)
  })

  it("redacts credentials in invalid configuration errors", () => {
    const secret = "test-write-key-must-not-appear-in-errors"
    try {
      createFlowmark({ apiKey: secret, apiUrl: "not-a-url" })
      expect.fail("Invalid URL must be rejected")
    } catch (error) {
      expect(error).toBeInstanceOf(FlowmarkConfigError)
      expect(inspect(error, { depth: null })).not.toContain(secret)
      expect(JSON.stringify(error)).not.toContain(secret)
    }
  })

  it("cancels timed-out requests and stops after bounded retries", async () => {
    const aborted = vi.fn()
    const fetcher = vi.fn<typeof fetch>(
      (_url, options) =>
        new Promise<Response>((_resolve, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => {
              aborted()
              reject(new Error("request aborted"))
            },
            { once: true },
          )
        }),
    )
    vi.stubGlobal("fetch", fetcher)
    const client = createFlowmark({
      apiKey: "key",
      apiUrl: "http://localhost",
      onInstrumentationError: vi.fn(),
    })
    client.workflow("timeout")
    await expect(client.shutdown()).rejects.toThrow()
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(aborted).toHaveBeenCalledTimes(3)
  }, 15000)
})
