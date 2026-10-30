import { Effect, Either, Option } from "effect"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { readDashboardOnboarding, readDashboardSession } from "../lib/session"

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [{ name: "session", value: "test-session" }],
  }),
}))

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production")
  vi.stubEnv("VERCEL_ENV", "")
  vi.stubEnv("FLOWMARK_API_URL", "http://localhost:3003")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it("authenticates server-rendered session and onboarding requests to the protected API", async () => {
  vi.stubEnv("FLOWMARK_VERCEL_PROTECTION_BYPASS", "test-protection-secret")
  const user = {
    id: "test-user",
    name: "Test owner",
    email: "test@example.invalid",
  }
  const state = { step: "run", completedAt: null }
  const fetch = vi.fn((url: URL, options: RequestInit) => {
    const headers = new Headers(options.headers)
    expect(headers.get("cookie")).toBe("session=test-session")
    expect(options.cache).toBe("no-store")
    expect(options.redirect).toBe("manual")
    if (
      headers.get("x-vercel-protection-bypass") !== "test-protection-secret"
    ) {
      return Promise.resolve(
        new Response("<!DOCTYPE html><title>Vercel login</title>"),
      )
    }
    return Promise.resolve(
      Response.json(
        url.pathname.includes("get-session")
          ? { user }
          : { result: { data: state } },
      ),
    )
  })
  vi.stubGlobal("fetch", fetch)
  expect(
    Option.getOrThrow(await Effect.runPromise(readDashboardSession())),
  ).toEqual({ user })
  expect(
    Option.getOrThrow(await Effect.runPromise(readDashboardOnboarding())),
  ).toEqual(state)
  expect(fetch).toHaveBeenCalledTimes(2)
})

it("omits the protection header when it is not configured", async () => {
  vi.stubEnv("FLOWMARK_VERCEL_PROTECTION_BYPASS", "")
  const fetch = vi.fn((_url: URL, options: RequestInit) => {
    expect(new Headers(options.headers).has("x-vercel-protection-bypass")).toBe(
      false,
    )
    return Promise.resolve(Response.json(null))
  })
  vi.stubGlobal("fetch", fetch)
  expect(Option.isNone(await Effect.runPromise(readDashboardSession()))).toBe(
    true,
  )
})

it("fails explicitly on an upstream redirect instead of following it with credentials", async () => {
  vi.stubEnv("FLOWMARK_VERCEL_PROTECTION_BYPASS", "test-protection-secret")
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 302 })),
  )
  const result = await Effect.runPromise(Effect.either(readDashboardSession()))
  Either.match(result, {
    onLeft: (error) =>
      expect(error).toMatchObject({ _tag: "DashboardSessionError" }),
    onRight: () => {
      throw new Error("Redirect must fail session lookup")
    },
  })
})
