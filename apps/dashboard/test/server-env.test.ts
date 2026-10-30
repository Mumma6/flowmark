import { afterEach, describe, expect, it, vi } from "vitest"
import { Effect, Result } from "effect"
import { dashboardApiUrl, dashboardDemoModeEnabled } from "../lib/server-env"

afterEach(() => {
  vi.unstubAllEnvs()
})
const leftReason = <A>(
  effect: Effect.Effect<
    A,
    {
      readonly reason: string
    }
  >,
) =>
  Result.match(Effect.runSync(Effect.result(effect)), {
    onFailure: (error) => error.reason,
    onSuccess: () => {
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
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "")
    vi.stubEnv("FLOWMARK_API_URL", "https://api.flowmark.dev")
    expect(leftReason(dashboardApiUrl())).toMatch(/api\.flowmark\.dev/)
  })

  it("calls the preview API deployment for the same git branch", () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "test-preview-dev")
    vi.stubEnv(
      "FLOWMARK_API_URL",
      "https://flowmark-api-mumma6s-projects.vercel.app",
    )
    expect(Effect.runSync(dashboardApiUrl())).toBe(
      "https://flowmark-api-git-test-preview-dev-mumma6s-projects.vercel.app",
    )
  })

  it("accepts a non-production API URL in preview", () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("FLOWMARK_API_URL", "https://preview.example")
    expect(Effect.runSync(dashboardApiUrl())).toBe("https://preview.example")
  })

  it.each(["invalid", "ftp://api.example", "https://user:opaque@api.example"])(
    "rejects an invalid API URL without exposing it",
    (value) => {
      vi.stubEnv("VERCEL_ENV", "")
      vi.stubEnv("FLOWMARK_API_URL", value)
      expect(leftReason(dashboardApiUrl())).toBe(
        "FLOWMARK_API_URL must be an HTTP(S) URL without credentials, query, or fragment.",
      )
    },
  )

  it("accepts the staging API and rejects demo mode there", () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "staging")
    vi.stubEnv("FLOWMARK_API_URL", "https://api.staging.flowmark.dev")
    vi.stubEnv("FLOWMARK_DEMO_MODE", "true")
    expect(Effect.runSync(dashboardApiUrl())).toBe(
      "https://api.staging.flowmark.dev",
    )
    expect(leftReason(dashboardDemoModeEnabled())).toMatch(/cannot be enabled/)
  })

  it("keeps demo mode off by default", () => {
    vi.stubEnv("FLOWMARK_DEMO_MODE", "")
    vi.stubEnv("NODE_ENV", "development")
    expect(Effect.runSync(dashboardDemoModeEnabled())).toBe(false)
  })
})
