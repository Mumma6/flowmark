import { randomUUID } from "node:crypto"
import { inspect } from "node:util"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { proxyToApiHandler } from "../lib/proxy-api"

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production")
  vi.stubEnv("VERCEL_ENV", "")
  vi.stubEnv("FLOWMARK_API_URL", "http://localhost:3003")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it("returns 500 for missing hosted API configuration without attempting fetch", async () => {
  vi.stubEnv("FLOWMARK_API_URL", "")
  const fetch = vi.fn()
  vi.stubGlobal("fetch", fetch)
  const response = await proxyToApiHandler(
    new Request("http://localhost/api/trpc"),
    "api/trpc",
  )
  expect(response.status).toBe(500)
  expect(await response.json()).toEqual({
    error: "FLOWMARK_API_URL is required in production.",
  })
  expect(fetch).not.toHaveBeenCalled()
})

it("returns 502 and logs only a safe label for an upstream transport failure", async () => {
  const target = new URL("http://localhost:3003")
  target.password = randomUUID()
  const privateValue = randomUUID()
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error(`${target.href} ${privateValue}`)),
  )
  const log = vi.spyOn(console, "error").mockImplementation(() => {})
  const response = await proxyToApiHandler(
    new Request("http://localhost/api/trpc"),
    "api/trpc",
  )
  expect(response.status).toBe(502)
  expect(await response.json()).toEqual({
    error: "Flowmark API is unavailable.",
  })
  expect(log).toHaveBeenCalledWith("[Flowmark dashboard] API request failed", {
    type: "DashboardProxyError",
  })
  const output = inspect(log.mock.calls)
  for (const value of [target.href, target.password, privateValue]) {
    expect(output.includes(value)).toBe(false)
  }
})

it("preserves an upstream storage 503 instead of converting it into a proxy 502", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { error: "Event storage is unavailable." },
          { status: 503 },
        ),
      ),
  )
  const log = vi.spyOn(console, "error").mockImplementation(() => {})
  const response = await proxyToApiHandler(
    new Request("http://localhost/api/trpc"),
    "api/trpc",
  )
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({
    error: "Event storage is unavailable.",
  })
  expect(log).not.toHaveBeenCalled()
})
