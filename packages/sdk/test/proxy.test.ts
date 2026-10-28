import { afterEach, describe, expect, it, vi } from "vitest"
import { createFlowmarkProxy } from "../src/adapters/proxy.js"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const input = {
  eventId: "00000000-0000-4000-8000-000000000003",
  event: {
    type: "started",
    workflow: "browser.test",
    runId: "run-1",
    timestamp: "2026-10-23T12:00:00.000Z",
  },
}
const config = {
  apiKey: "server-only-write-key",
  apiUrl: "http://localhost:3003",
}

function request(
  body: unknown = input,
  origin: string | null = "https://customer.example",
) {
  const headers = new Headers({ "content-type": "application/json" })
  if (origin !== null) {
    headers.set("origin", origin)
  }
  return new Request("https://customer.example/api/flowmark", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}

describe("server-only workflow proxy", () => {
  it("forwards validated events to a fixed API with a server-only key and stable event ID", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 202 }),
    )
    vi.stubGlobal("fetch", fetcher)
    const incoming = request({
      ...input,
      projectId: "cannot-choose-project",
      endpoint: "https://attacker.example",
    })
    incoming.headers.set("authorization", "Bearer untrusted-browser-value")
    const response = await createFlowmarkProxy(config)(incoming)
    expect(response.status).toBe(202)
    expect(await response.text()).not.toContain(config.apiKey)
    expect(fetcher).toHaveBeenCalledOnce()
    const [url, options] = fetcher.mock.calls[0]
    expect(url.toString()).toBe("http://localhost:3003/v1/events")
    expect(new Headers(options?.headers).get("authorization")).toBe(
      `Bearer ${config.apiKey}`,
    )
    expect(JSON.parse(await new Response(options?.body).text())).toEqual(input)
    expect(response.headers.has("access-control-allow-origin")).toBe(false)
  })

  it.each(["https://attacker.example", "null", null])(
    "rejects cross-origin or absent origins: %s",
    async (origin) => {
      const fetcher = vi.fn()
      vi.stubGlobal("fetch", fetcher)
      expect(
        (await createFlowmarkProxy(config)(request(input, origin))).status,
      ).toBe(403)
      expect(fetcher).not.toHaveBeenCalled()
    },
  )

  it("checks customer authentication before reading the body", async () => {
    const fetcher = vi.fn()
    vi.stubGlobal("fetch", fetcher)
    const authorize = vi.fn(async () => false)
    const response = await createFlowmarkProxy({ ...config, authorize })(
      request("{bad-json"),
    )
    expect(response.status).toBe(403)
    expect(authorize).toHaveBeenCalledOnce()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("allows authenticated same-origin submissions", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 202 }),
    )
    vi.stubGlobal("fetch", fetcher)
    const authorize = vi.fn(async () => true)
    expect(
      (await createFlowmarkProxy({ ...config, authorize })(request())).status,
    ).toBe(202)
    expect(authorize).toHaveBeenCalledOnce()
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it("rejects contradictory browser cross-site metadata", async () => {
    const fetcher = vi.fn()
    vi.stubGlobal("fetch", fetcher)
    const incoming = request()
    incoming.headers.set("sec-fetch-site", "cross-site")
    expect((await createFlowmarkProxy(config)(incoming)).status).toBe(403)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("rejects malformed JSON without forwarding", async () => {
    const fetcher = vi.fn()
    vi.stubGlobal("fetch", fetcher)
    const incoming = new Request("https://customer.example/api/flowmark", {
      method: "POST",
      headers: { origin: "https://customer.example" },
      body: "{",
    })
    expect((await createFlowmarkProxy(config)(incoming)).status).toBe(400)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("logs authorization exceptions as failures rather than accepting delivery", async () => {
    const fetcher = vi.fn()
    vi.stubGlobal("fetch", fetcher)
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    const response = await createFlowmarkProxy({
      ...config,
      authorize: () => {
        throw new Error("session service unavailable")
      },
    })(request())
    expect(response.status).toBe(502)
    expect(log).toHaveBeenCalledOnce()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it.each([
    { ...input, eventId: "invalid" },
    { ...input, event: { ...input.event, workflow: "" } },
    { ...input, event: { ...input.event, timestamp: "invalid" } },
  ])("rejects invalid envelopes: %j", async (body) => {
    const fetcher = vi.fn()
    vi.stubGlobal("fetch", fetcher)
    expect((await createFlowmarkProxy(config)(request(body))).status).toBe(400)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("cancels oversized streams before forwarding", async () => {
    const fetcher = vi.fn()
    vi.stubGlobal("fetch", fetcher)
    const cancel = vi.fn()
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          controller.enqueue(new Uint8Array(32769))
        },
        cancel,
      },
      { highWaterMark: 0 },
    )
    const options: RequestInit & { duplex: "half" } = {
      method: "POST",
      headers: { origin: "https://customer.example" },
      body,
      duplex: "half",
    }
    const response = await createFlowmarkProxy(config)(
      new Request("https://customer.example/api/flowmark", options),
    )
    expect(response.status).toBe(400)
    expect(cancel).toHaveBeenCalledOnce()
    expect(body.locked).toBe(false)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it.each([65536, 65537])(
    "enforces the exact byte boundary for a %i-byte payload",
    async (bytes) => {
      const fetcher = vi.fn<typeof fetch>(
        async () => new Response(null, { status: 202 }),
      )
      vi.stubGlobal("fetch", fetcher)
      const json = JSON.stringify(input)
      const body =
        json + " ".repeat(bytes - new TextEncoder().encode(json).length)
      const incoming = new Request("https://customer.example/api/flowmark", {
        method: "POST",
        headers: { origin: "https://customer.example" },
        body,
      })
      const response = await createFlowmarkProxy(config)(incoming)
      expect(response.status).toBe(bytes === 65536 ? 202 : 400)
      expect(fetcher).toHaveBeenCalledTimes(bytes === 65536 ? 1 : 0)
    },
  )

  it("propagates request cancellation to the upstream request", async () => {
    const aborted = vi.fn()
    let started!: () => void
    const ready = new Promise<void>((resolve) => {
      started = resolve
    })
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(
        (_url, options) =>
          new Promise<Response>((_resolve, reject) => {
            options?.signal?.addEventListener(
              "abort",
              () => {
                aborted()
                reject(new Error("aborted"))
              },
              { once: true },
            )
            started()
          }),
      ),
    )
    vi.spyOn(console, "error").mockImplementation(() => {})
    const controller = new AbortController()
    const incoming = new Request(request(), { signal: controller.signal })
    const result = createFlowmarkProxy(config)(incoming)
    await ready
    controller.abort()
    expect((await result).status).toBe(502)
    expect(aborted).toHaveBeenCalledOnce()
  })

  it.each([400, 409, 429, 401, 500])(
    "maps upstream HTTP %i explicitly",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>(async () => new Response(null, { status })),
      )
      vi.spyOn(console, "error").mockImplementation(() => {})
      const response = await createFlowmarkProxy(config)(request())
      expect(response.status).toBe(
        [400, 409, 429].includes(status) ? status : 502,
      )
    },
  )
})
