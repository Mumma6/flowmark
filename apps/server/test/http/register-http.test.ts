import { Effect } from "effect"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { registerOwner } from "../../src/adapters/register-http"

const { handler } = vi.hoisted(() => ({ handler: vi.fn() }))
vi.mock("../../src/auth", () => ({
  getAuth: () => Effect.succeed({ handler }),
}))

const request = (
  body: unknown = {
    name: " Owner ",
    email: " owner@example.test ",
    password: "test-only-password",
  },
) =>
  new Request(
    "http://localhost/api/register?callbackURL=https://untrusted.example",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://untrusted.example",
        cookie: "test-cookie=value",
        "sec-fetch-site": "cross-site",
      },
      body: JSON.stringify(body),
    },
  )

beforeEach(() => {
  handler.mockReset()
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://127.0.0.1:1/unused_register_unit_test",
  )
  vi.stubEnv("VERCEL_ENV", "")
  vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

it("routes registration through provider HTTP protections and preserves the public success contract", async () => {
  handler.mockResolvedValue(
    Response.json(
      { token: "private-token", user: { id: "private-user" } },
      {
        headers: { "set-cookie": "private-session=value" },
      },
    ),
  )
  const incoming = request()
  const response = await registerOwner(incoming)
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ ok: true })
  expect(response.headers.get("cache-control")).toBe("no-store")
  expect(response.headers.has("set-cookie")).toBe(false)
  const forwarded = handler.mock.calls[0][0] as Request
  expect(new URL(forwarded.url).pathname).toBe("/api/auth/sign-up/email")
  expect(new URL(forwarded.url).search).toBe("")
  for (const name of ["origin", "cookie", "sec-fetch-site"]) {
    expect(forwarded.headers.get(name)).toBe(incoming.headers.get(name))
  }
  expect(await forwarded.json()).toEqual({
    name: "Owner",
    email: "owner@example.test",
    password: "test-only-password",
  })
})

it.each([400, 403, 422, 500, 503])(
  "keeps provider rejection %i without exposing provider details",
  async (status) => {
    handler.mockResolvedValue(
      Response.json({ message: "sensitive provider detail" }, { status }),
    )
    const response = await registerOwner(request())
    expect(response.status).toBe(status)
    expect(await response.json()).toEqual({
      error: "Could not create the account.",
    })
  },
)

it("keeps 429 and both supported retry headers", async () => {
  handler.mockResolvedValue(
    new Response("limited", {
      status: 429,
      headers: { "retry-after": "10", "x-retry-after": "10" },
    }),
  )
  const response = await registerOwner(request())
  expect(response.status).toBe(429)
  expect(await response.json()).toEqual({
    error: "Too many requests. Please try again later.",
  })
  expect(response.headers.get("retry-after")).toBe("10")
  expect(response.headers.get("x-retry-after")).toBe("10")
})

it("reports provider transport failure as unavailable", async () => {
  handler.mockRejectedValue(new Error("private connection failure"))
  const response = await registerOwner(request())
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({
    error: "Could not create the account.",
  })
})

it("rejects invalid registration input before invoking the provider", async () => {
  const response = await registerOwner(
    request({ email: "owner@example.test", password: "short" }),
  )
  expect(response.status).toBe(400)
  expect(handler).not.toHaveBeenCalled()
})
