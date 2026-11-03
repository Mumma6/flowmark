import { Array as Arr, Effect, Layer, Result } from "effect"
import { afterEach, expect, it, vi } from "vitest"
import { DashboardApi } from "../features/platform/api-server-client"
import { DashboardServerConfig } from "../features/platform/config-server"

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
  const responses = await Effect.runPromise(
    Effect.forEach(
      [
        ["https://preview.example", "synthetic-preview"],
        ["https://staging.example", "synthetic-staging"],
      ],
      ([origin, secret]) =>
        Effect.gen(function* () {
          const client = yield* DashboardApi
          return yield* client.request(
            "/api/trpc/run.list",
            { headers: { cookie: "synthetic-session" } },
            8000,
          )
        }).pipe(Effect.provide(api(origin, secret))),
      { concurrency: 2 },
    ),
  )
  Arr.forEach(responses, (response) => expect(response.status).toBe(503))
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
