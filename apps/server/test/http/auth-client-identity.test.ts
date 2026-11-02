import { Effect } from "effect"
import { expect, it } from "vitest"
import {
  AUTH_CLIENT_IP_HEADER,
  AUTH_PROXY_IDENTITY_HEADER,
  normalizeAuthClientIdentity,
  signAuthProxyIdentity,
} from "@flowmark/db/auth/client-identity"

const secret = "synthetic-proxy-secret-at-least-thirty-two-characters"
const timestamp = 1793616000000
const request = (
  path = "/api/auth/sign-in/email",
  headers?: HeadersInit,
  method = "POST",
) => new Request(`https://dashboard.example${path}`, { method, headers })
const run = Effect.runPromise

it("rebuilds framework requests by URL and preserves streamed bodies and cancellation", async () => {
  const controller = new AbortController()
  const original = new Request(
    "https://dashboard.example/api/auth/sign-in/email",
    {
      method: "POST",
      body: JSON.stringify({ email: "synthetic@example.test" }),
      headers: { "content-type": "application/json" },
      signal: controller.signal,
    },
  )
  const foreign = {
    url: original.url,
    method: original.method,
    headers: original.headers,
    body: original.body,
    signal: original.signal,
  } as Request
  const normalized = await run(
    normalizeAuthClientIdentity(foreign, {}, timestamp),
  )
  expect(normalized.url).toBe(original.url)
  expect(normalized.method).toBe("POST")
  expect(await normalized.json()).toEqual({ email: "synthetic@example.test" })
  expect(normalized.signal.aborted).toBe(false)
  controller.abort()
  expect(normalized.signal.aborted).toBe(true)
})

it("ignores forged internal/IP headers when no proxy has been explicitly trusted", async () => {
  const normalized = await run(
    normalizeAuthClientIdentity(
      request(undefined, {
        [AUTH_CLIENT_IP_HEADER]: "203.0.113.1",
        "x-forwarded-for": "203.0.113.2",
        "x-real-ip": "203.0.113.3",
        "x-vercel-forwarded-for": "203.0.113.4",
      }),
      {},
      timestamp,
    ),
  )
  expect(normalized.headers.has(AUTH_CLIENT_IP_HEADER)).toBe(false)
})

it("takes only the platform-controlled single IP in an actual Vercel runtime", async () => {
  const normalized = await run(
    normalizeAuthClientIdentity(
      request(undefined, {
        "x-vercel-forwarded-for": "203.0.113.5",
        "x-forwarded-for": "203.0.113.6",
      }),
      { VERCEL: "1" },
      timestamp,
    ),
  )
  expect(normalized.headers.get(AUTH_CLIENT_IP_HEADER)).toBe("203.0.113.5")
  const chain = await run(
    normalizeAuthClientIdentity(
      request(undefined, {
        "x-vercel-forwarded-for": "203.0.113.1, 203.0.113.2",
      }),
      { VERCEL: "1" },
      timestamp,
    ),
  )
  expect(chain.headers.has(AUTH_CLIENT_IP_HEADER)).toBe(false)
})

it("authenticates the dashboard hop and canonicalizes the registration alias", async () => {
  const identity = await run(
    signAuthProxyIdentity(
      request("/api/register", { "x-vercel-forwarded-for": "203.0.113.7" }),
      "/api/register",
      { VERCEL: "1", FLOWMARK_AUTH_PROXY_SECRET: secret },
      timestamp,
    ),
  )
  const normalized = await run(
    normalizeAuthClientIdentity(
      request("/api/auth/sign-up/email", {
        [AUTH_PROXY_IDENTITY_HEADER]: identity!,
        "x-vercel-forwarded-for": "203.0.113.99",
      }),
      { VERCEL: "1", FLOWMARK_AUTH_PROXY_SECRET: secret },
      timestamp + 1000,
    ),
  )
  expect(normalized.headers.get(AUTH_CLIENT_IP_HEADER)).toBe("203.0.113.7")
  expect(normalized.headers.has(AUTH_PROXY_IDENTITY_HEADER)).toBe(false)
})

it("preserves an attested missing IP without replacing it with the dashboard egress IP", async () => {
  const identity = await run(
    signAuthProxyIdentity(
      request(),
      "/api/auth/sign-in/email",
      { FLOWMARK_AUTH_PROXY_SECRET: secret },
      timestamp,
    ),
  )
  const normalized = await run(
    normalizeAuthClientIdentity(
      request(undefined, {
        [AUTH_PROXY_IDENTITY_HEADER]: identity!,
        "x-vercel-forwarded-for": "203.0.113.99",
      }),
      { VERCEL: "1", FLOWMARK_AUTH_PROXY_SECRET: secret },
      timestamp,
    ),
  )
  expect(normalized.headers.has(AUTH_CLIENT_IP_HEADER)).toBe(false)
})

it("rejects changed IP, endpoint, method, signature, expired/future assertions and mismatched secrets", async () => {
  const env = { VERCEL: "1", FLOWMARK_AUTH_PROXY_SECRET: secret }
  const identity = await run(
    signAuthProxyIdentity(
      request(undefined, { "x-vercel-forwarded-for": "203.0.113.8" }),
      "/api/auth/sign-in/email",
      env,
      timestamp,
    ),
  )
  for (const [path, method, assertion, now, configured] of [
    [
      "/api/auth/sign-in/email",
      "POST",
      identity!.replace("203.0.113.8", "203.0.113.9"),
      timestamp,
      secret,
    ],
    ["/api/auth/sign-up/email", "POST", identity!, timestamp, secret],
    ["/api/auth/sign-in/email", "GET", identity!, timestamp, secret],
    [
      "/api/auth/sign-in/email",
      "POST",
      identity!.slice(0, -1) + "x",
      timestamp,
      secret,
    ],
    ["/api/auth/sign-in/email", "POST", identity!, timestamp + 31000, secret],
    ["/api/auth/sign-in/email", "POST", identity!, timestamp - 6000, secret],
    ["/api/auth/sign-in/email", "POST", identity!, timestamp, secret + "other"],
  ] as const) {
    await expect(
      run(
        normalizeAuthClientIdentity(
          request(path, { [AUTH_PROXY_IDENTITY_HEADER]: assertion }, method),
          { FLOWMARK_AUTH_PROXY_SECRET: configured },
          now,
        ),
      ),
    ).rejects.toThrow()
  }
})

it("fails configuration explicitly instead of trusting an unsigned assertion", async () => {
  await expect(
    run(
      normalizeAuthClientIdentity(
        request(undefined, { [AUTH_PROXY_IDENTITY_HEADER]: "untrusted" }),
        {},
        timestamp,
      ),
    ),
  ).rejects.toThrow()
  await expect(
    run(
      signAuthProxyIdentity(
        request(),
        "/api/auth/sign-in/email",
        { FLOWMARK_AUTH_PROXY_SECRET: "short" },
        timestamp,
      ),
    ),
  ).rejects.toThrow()
})
