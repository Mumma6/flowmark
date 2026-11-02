import { Effect, Layer, Result } from "effect"
import { afterEach, expect, it, vi } from "vitest"
import { DashboardApi } from "../lib/api/server-client"
import { DashboardServerConfig } from "../lib/config/server"

const api = (apiUrl: string, protectionBypass?: string) =>
  DashboardApi.layer.pipe(
    Layer.provide(
      Layer.succeed(DashboardServerConfig, { apiUrl, protectionBypass }),
    ),
  )
afterEach(() => vi.unstubAllGlobals())
it("isolates API origins and protection credentials across executions and preserves failure statuses", async () => {
  const fetch = vi
    .fn()
    .mockImplementation((_url: URL, options: RequestInit) => {
      expect(options.cache).toBe("no-store")
      expect(options.redirect).toBe("manual")
      return Promise.resolve(
        Response.json({ error: "Unavailable" }, { status: 503 }),
      )
    })
  vi.stubGlobal("fetch", fetch)
  for (const [origin, secret] of [
    ["https://preview.example", "synthetic-preview"],
    ["https://staging.example", "synthetic-staging"],
  ]) {
    const response = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* DashboardApi
        return yield* client.request(
          "/api/trpc/run.list",
          { headers: { cookie: "synthetic-session" } },
          8000,
        )
      }).pipe(Effect.provide(api(origin, secret))),
    )
    expect(response.status).toBe(503)
  }
  expect(
    fetch.mock.calls.map(([url, options]) => [
      url.origin,
      new Headers(options.headers).get("x-vercel-protection-bypass"),
    ]),
  ).toEqual([
    ["https://preview.example", "synthetic-preview"],
    ["https://staging.example", "synthetic-staging"],
  ])
})
it("keeps transport failures typed with operation and original cause", async () => {
  const cause = new Error("synthetic transport failure")
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(cause))
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const client = yield* DashboardApi
      return yield* client.request("/api/auth/get-session", {}, 8000)
    }).pipe(Effect.provide(api("https://preview.example")), Effect.result),
  )
  Result.match(result, {
    onFailure: (error) =>
      expect(error).toMatchObject({
        _tag: "DashboardRequestError",
        operation: "/api/auth/get-session",
        cause,
      }),
    onSuccess: () => {
      throw new Error("Unexpected successful request")
    },
  })
})
