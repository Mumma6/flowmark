import { afterEach, describe, expect, it, vi } from "vitest"
import { Effect, Either } from "effect"
import { serverOrigins } from "../../src/server-env"
import { handleTrpc, handleTrpcOptions } from "../../src/adapters/trpc-http"

const reason = (env: NodeJS.ProcessEnv) =>
  Either.match(Effect.runSync(Effect.either(serverOrigins(env))), {
    onLeft: (error) => error.reason,
    onRight: () => "unexpected success",
  })
afterEach(() => vi.unstubAllEnvs())

describe("server environment", () => {
  it("provides local defaults only for development", () => {
    expect(Effect.runSync(serverOrigins({ NODE_ENV: "development" }))).toEqual({
      dashboardOrigin: "http://localhost:3001",
      baseURL: "http://localhost:3001",
    })
  })
  it.each([
    { NODE_ENV: "production" as const },
    { NODE_ENV: "test" as const, VERCEL_ENV: "production" },
    { NODE_ENV: "test" as const, VERCEL_ENV: "preview" },
  ])("requires hosted origins: %j", (env) => {
    expect(reason(env)).toContain("FLOWMARK_DASHBOARD_ORIGIN is required")
    expect(
      reason({
        ...env,
        FLOWMARK_DASHBOARD_ORIGIN: "https://dashboard.example",
      }),
    ).toContain("BETTER_AUTH_URL is required")
  })
  it.each([
    "invalid",
    "ftp://dashboard.example",
    "https://dashboard.example/path",
    "https://dashboard.example?query=1",
    "https://user:opaque@dashboard.example",
  ])("rejects invalid origins without including their values", (value) => {
    expect(reason({ NODE_ENV: "test", FLOWMARK_DASHBOARD_ORIGIN: value })).toBe(
      "FLOWMARK_DASHBOARD_ORIGIN must be an HTTP(S) origin without credentials, path, query, or fragment.",
    )
  })
  it("accepts custom production origins and normalizes a trailing slash", () => {
    expect(
      Effect.runSync(
        serverOrigins({
          NODE_ENV: "production",
          FLOWMARK_DASHBOARD_ORIGIN: "https://dashboard.example/",
          BETTER_AUTH_URL: "https://auth.example/",
        }),
      ),
    ).toEqual({
      dashboardOrigin: "https://dashboard.example",
      baseURL: "https://auth.example",
    })
  })
  it("uses the sibling preview origin for both auth and CORS", () => {
    const origins = Effect.runSync(
      serverOrigins({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "feature/test",
        FLOWMARK_DASHBOARD_ORIGIN: "https://app.flowmark.dev",
        BETTER_AUTH_URL: "https://app.flowmark.dev",
      }),
    )
    expect(origins.dashboardOrigin).toBe(
      "https://flowmark-dashboard-git-feature-test-mumma6s-projects.vercel.app",
    )
    expect(origins.baseURL).toBe(origins.dashboardOrigin)
  })
  it("preserves staging isolation", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      VERCEL_GIT_COMMIT_REF: "staging",
      FLOWMARK_DASHBOARD_ORIGIN: "https://app.staging.flowmark.dev",
      BETTER_AUTH_URL: "https://app.staging.flowmark.dev",
    }
    expect(Effect.runSync(serverOrigins(env)).dashboardOrigin).toBe(
      env.FLOWMARK_DASHBOARD_ORIGIN,
    )
    expect(
      reason({ ...env, BETTER_AUTH_URL: "https://auth.example" }),
    ).not.toBe("unexpected success")
  })
  it("validates requests after import and does not execute procedures with missing configuration", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("VERCEL_ENV", "")
    vi.stubEnv("FLOWMARK_DASHBOARD_ORIGIN", "")
    const req = new Request("http://localhost/api/trpc/health.check")
    expect((await handleTrpc(req)).status).toBe(500)
    expect((await handleTrpcOptions(req)).status).toBe(500)
    vi.stubEnv("FLOWMARK_DASHBOARD_ORIGIN", "https://dashboard.example")
    vi.stubEnv("BETTER_AUTH_URL", "https://dashboard.example")
    expect((await handleTrpc(req)).status).toBe(200)
    const allowed = await handleTrpcOptions(
      new Request(req, { headers: { origin: "https://dashboard.example" } }),
    )
    expect(allowed.status).toBe(204)
    expect(allowed.headers.get("access-control-allow-origin")).toBe(
      "https://dashboard.example",
    )
    expect(
      (await handleTrpcOptions(req)).headers.has("access-control-allow-origin"),
    ).toBe(false)
  })
})
