import { randomUUID } from "node:crypto"
import { inspect } from "node:util"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { proxyToApiHandler } from "../lib/proxy-api"
import { Effect } from "effect"
import {
  AUTH_CLIENT_IP_HEADER,
  AUTH_PROXY_IDENTITY_HEADER,
  normalizeAuthClientIdentity,
} from "@flowmark/auth/client-identity"

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production")
  vi.stubEnv("VERCEL_ENV", "")
  vi.stubEnv("FLOWMARK_API_URL", "http://localhost:3003")
  vi.stubEnv("FLOWMARK_AUTH_PROXY_SECRET", undefined)
  vi.stubEnv("FLOWMARK_AUTH_TRUSTED_IP_HEADER", undefined)
  vi.stubEnv("VERCEL", "")
})

it("signs platform client identity on the server and drops browser-supplied assertions", async () => {
  const secret = "synthetic-proxy-test-secret-with-sufficient-length"
  vi.stubEnv("VERCEL", "1")
  vi.stubEnv("FLOWMARK_AUTH_PROXY_SECRET", secret)
  const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true }))
  vi.stubGlobal("fetch", fetch)
  await proxyToApiHandler(
    new Request("https://dashboard.example/api/register", {
      method: "POST",
      headers: {
        "x-vercel-forwarded-for": "203.0.113.42",
        [AUTH_PROXY_IDENTITY_HEADER]: "browser-controlled",
        [AUTH_CLIENT_IP_HEADER]: "203.0.113.99",
      },
      body: "{}",
    }),
    "/api/register",
  )
  const headers = fetch.mock.calls[0][1].headers as Headers
  expect(headers.get(AUTH_PROXY_IDENTITY_HEADER)).not.toBe("browser-controlled")
  expect(headers.has(AUTH_CLIENT_IP_HEADER)).toBe(false)
  const normalized = await Effect.runPromise(
    normalizeAuthClientIdentity(
      new Request("https://api.example/api/auth/sign-up/email", {
        method: "POST",
        headers,
      }),
      { FLOWMARK_AUTH_PROXY_SECRET: secret },
    ),
  )
  expect(normalized.headers.get(AUTH_CLIENT_IP_HEADER)).toBe("203.0.113.42")
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

it("preserves provider retry guidance and browser CSRF metadata without forwarding claimed client IPs", async () => {
  const fetch = vi.fn().mockResolvedValue(
    Response.json(
      { message: "Too many requests." },
      {
        status: 429,
        headers: { "retry-after": "30", "x-retry-after": "30" },
      },
    ),
  )
  vi.stubGlobal("fetch", fetch)
  const response = await proxyToApiHandler(
    new Request("http://localhost/api/register", {
      method: "POST",
      headers: {
        origin: "https://untrusted.example",
        "sec-fetch-site": "cross-site",
        "x-forwarded-for": "203.0.113.1",
        "x-real-ip": "203.0.113.2",
        "x-vercel-forwarded-for": "203.0.113.3",
      },
      body: "{}",
    }),
    "/api/register",
  )
  expect(response.status).toBe(429)
  expect(response.headers.get("cache-control")).toBe("no-store")
  for (const name of ["retry-after", "x-retry-after"]) {
    expect(response.headers.get(name)).toBe("30")
  }
  const forwarded = fetch.mock.calls[0][1].headers as Headers
  expect(forwarded.get("origin")).toBe("https://untrusted.example")
  expect(forwarded.get("sec-fetch-site")).toBe("cross-site")
  for (const name of [
    "x-forwarded-for",
    "x-real-ip",
    "x-vercel-forwarded-for",
  ]) {
    expect(forwarded.has(name)).toBe(false)
  }
})
