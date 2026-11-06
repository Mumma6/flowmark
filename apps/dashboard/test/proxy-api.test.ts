import { Array as EffectArray } from "effect"
import {
  AUTH_CLIENT_IP_HEADER,
  AUTH_PROXY_IDENTITY_HEADER,
  normalizeAuthClientIdentity,
} from "@flowmark/auth/client-identity"
import { Effect } from "effect"
import { randomUUID } from "node:crypto"
import { inspect } from "node:util"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import {
  proxyIssuerPath,
  proxyToApiHandler,
} from "../features/platform/api-proxy"

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
  EffectArray.forEach(
    EffectArray.fromIterable([target.href, target.password, privateValue]),
    (value) => {
      expect(output.includes(value)).toBe(false)
    },
  )
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

it("feeds the browser transport mapper the same safe 502 copy", async () => {
  const { readDashboardTransportError, proxyUnavailableMessage } =
    await import("../features/platform/api-transport-errors")
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("upstream down")))
  const response = await proxyToApiHandler(
    new Request("http://localhost/api/trpc"),
    "api/trpc",
  )
  expect(response.status).toBe(502)
  expect(await readDashboardTransportError(response)).toBe(
    proxyUnavailableMessage,
  )
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
  EffectArray.forEach(
    EffectArray.fromIterable(["retry-after", "x-retry-after"]),
    (name) => {
      expect(response.headers.get(name)).toBe("30")
    },
  )
  const forwarded = fetch.mock.calls[0][1].headers as Headers
  expect(forwarded.get("origin")).toBe("https://untrusted.example")
  expect(forwarded.get("sec-fetch-site")).toBe("cross-site")
  EffectArray.forEach(
    EffectArray.fromIterable([
      "x-forwarded-for",
      "x-real-ip",
      "x-vercel-forwarded-for",
    ]),
    (name) => {
      expect(forwarded.has(name)).toBe(false)
    },
  )
})

it("forwards same-origin auth callback redirects without caching or referrer leakage", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: {
          location:
            "https://dashboard.example/reset-password?token=synthetic-preview-token",
        },
      }),
    ),
  )
  const response = await proxyToApiHandler(
    new Request(
      "https://dashboard.example/api/auth/reset-password/synthetic-preview-token",
    ),
    "/api/auth/reset-password/synthetic-preview-token",
  )
  expect(response.status).toBe(302)
  expect(response.headers.get("location")).toBe(
    "https://dashboard.example/reset-password?token=synthetic-preview-token",
  )
  expect(response.headers.get("cache-control")).toBe("no-store")
  expect(response.headers.get("referrer-policy")).toBe("no-referrer")
})

it("blocks cross-origin callback redirects and does not leak their bearer URL", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {})
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: {
          location:
            "https://untrusted.example/reset?token=synthetic-preview-token",
        },
      }),
    ),
  )
  const response = await proxyToApiHandler(
    new Request(
      "https://dashboard.example/api/auth/reset-password/synthetic-preview-token",
    ),
    "/api/auth/reset-password/synthetic-preview-token",
  )
  expect(response.status).toBe(502)
  expect(response.headers.has("location")).toBe(false)
  expect(response.headers.get("cache-control")).toBe("no-store")
  expect(JSON.stringify(log.mock.calls)).not.toContain(
    "synthetic-preview-token",
  )
})

it("forwards an authorization request to the API origin and returns the provider response", async () => {
  const redirectUri = "http://127.0.0.1:4312/callback"
  const fetch = vi.fn().mockResolvedValue(
    new Response(null, {
      status: 302,
      headers: {
        location: `${redirectUri}?code=synthetic&state=one`,
        "content-type": "application/json",
      },
    }),
  )
  vi.stubGlobal("fetch", fetch)
  const response = await proxyIssuerPath(
    new Request(
      `https://dashboard.example/oauth2/authorize?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=one`,
    ),
    "/oauth2/authorize",
  )
  const target = fetch.mock.calls[0][0] as URL
  expect(target.origin).toBe("http://localhost:3003")
  expect(target.pathname).toBe("/api/auth/oauth2/authorize")
  expect(target.searchParams.get("redirect_uri")).toBe(redirectUri)
  expect(target.searchParams.get("state")).toBe("one")
  expect(response.status).toBe(302)
  expect(response.headers.get("location")).toBe(
    `${redirectUri}?code=synthetic&state=one`,
  )
  expect(response.headers.get("access-control-allow-origin")).toBeNull()
  expect(response.headers.get("cache-control")).toBe("no-store")
})

it("preserves token status, media type and protocol headers", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json(
        { access_token: "synthetic-access-token", token_type: "Bearer" },
        {
          status: 200,
          headers: { "www-authenticate": 'Bearer error="invalid_token"' },
        },
      ),
    ),
  )
  const response = await proxyIssuerPath(
    new Request("https://dashboard.example/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "grant_type=authorization_code&code=synthetic",
    }),
    "/oauth2/token",
  )
  expect(response.status).toBe(200)
  expect(response.headers.get("content-type")).toContain("application/json")
  expect(response.headers.get("www-authenticate")).toBe(
    'Bearer error="invalid_token"',
  )
  expect(response.headers.get("cache-control")).toBe("no-store")
  const body = await response.json()
  expect(body.token_type).toBe("Bearer")
})

it("denies a foreign authorize redirect and does not widen ordinary auth redirects", async () => {
  const foreign =
    "https://untrusted.example/callback?code=synthetic-preview-token"
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(null, { status: 302, headers: { location: foreign } }),
    )
  vi.stubGlobal("fetch", fetch)
  const log = vi.spyOn(console, "error").mockImplementation(() => {})
  const oauth = await proxyIssuerPath(
    new Request(
      "https://dashboard.example/oauth2/authorize?redirect_uri=http%3A%2F%2F127.0.0.1%3A4312%2Fcallback",
    ),
    "/oauth2/authorize",
  )
  expect(oauth.status).toBe(502)
  expect(oauth.headers.has("location")).toBe(false)
  const ordinary = await proxyToApiHandler(
    new Request(
      "https://dashboard.example/api/auth/oauth2/authorize?redirect_uri=http%3A%2F%2F127.0.0.1%3A4312%2Fcallback",
    ),
    "/api/auth/oauth2/authorize",
  )
  expect(ordinary.status).toBe(502)
  expect(ordinary.headers.has("location")).toBe(false)
  expect(JSON.stringify(log.mock.calls)).not.toContain(
    "synthetic-preview-token",
  )
})

it("ignores a spoofed forwarded host when selecting the API origin", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(Response.json({ issuer: "https://dashboard.example" }))
  vi.stubGlobal("fetch", fetch)
  const response = await proxyIssuerPath(
    new Request(
      "https://dashboard.example/.well-known/oauth-authorization-server",
      { headers: { "x-forwarded-host": "untrusted.example" } },
    ),
    "/.well-known/oauth-authorization-server",
  )
  const target = fetch.mock.calls[0][0] as URL
  expect(target.origin).toBe("http://localhost:3003")
  expect(target.pathname).toBe(
    "/api/auth/.well-known/oauth-authorization-server",
  )
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({
    issuer: "https://dashboard.example",
  })
})
