import { afterEach, describe, expect, it, vi } from "vitest"
import { Effect, Either } from "effect"
import { dashboardApiUrl, dashboardDemoModeEnabled } from "../lib/server-env"

afterEach(() => {
  vi.unstubAllEnvs()
})

const leftReason = <A>(effect: Effect.Effect<A, { readonly reason: string }>) =>
  Either.match(Effect.runSync(Effect.either(effect)), {
    onLeft: (error) => error.reason,
    onRight: () => {
      throw new Error("expected a typed configuration failure")
    },
  })

describe("dashboard server environment", () => {
  it("uses a local API URL only outside production", () => {
    vi.stubEnv("FLOWMARK_API_URL", "")
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("VERCEL_ENV", "")
    expect(Effect.runSync(dashboardApiUrl())).toBe("http://localhost:3003")
  })

  it("requires FLOWMARK_API_URL in production", () => {
    vi.stubEnv("FLOWMARK_API_URL", "")
    vi.stubEnv("NODE_ENV", "production")
    expect(leftReason(dashboardApiUrl())).toMatch(/FLOWMARK_API_URL/)
  })

  it("rejects demo mode in production", () => {
    vi.stubEnv("FLOWMARK_DEMO_MODE", "true")
    vi.stubEnv("NODE_ENV", "production")
    expect(leftReason(dashboardDemoModeEnabled())).toMatch(/cannot be enabled/)
  })

  it("rejects the production API from a preview dashboard", () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    vi.stubEnv("FLOWMARK_API_URL", "https://api.flowmark.dev")
    expect(leftReason(dashboardApiUrl())).toMatch(/api\.flowmark\.dev/)
  })

  it("accepts a non-production API URL in preview", () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("FLOWMARK_API_URL", "https://preview.example")
    expect(Effect.runSync(dashboardApiUrl())).toBe("https://preview.example")
  })

  it("keeps demo mode off by default", () => {
    vi.stubEnv("FLOWMARK_DEMO_MODE", "")
    vi.stubEnv("NODE_ENV", "development")
    expect(Effect.runSync(dashboardDemoModeEnabled())).toBe(false)
  })
})
