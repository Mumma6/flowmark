import { afterEach, expect, it, vi } from "vitest"
import { Effect, Layer } from "effect"
import { McpAuthGateway } from "../src/ports/mcp-auth-gateway.js"
import { McpHostConfiguration } from "../src/ports/mcp-host-configuration.js"
import { McpDiscoveryError } from "../src/errors.js"
import {
  createMcpHttpRoutes,
  resetMcpRouteCacheForTests,
  type RunMcpEffect,
} from "../src/routes/http-routes.js"

afterEach(() => {
  resetMcpRouteCacheForTests()
  vi.unstubAllEnvs()
})

it("retries transient discovery failures instead of caching an outage", async () => {
  vi.stubEnv("FLOWMARK_AGENT_ACCESS_ENABLED", "true")
  vi.stubEnv("FLOWMARK_API_URL", "http://127.0.0.1:3902")
  const discover = vi
    .fn()
    .mockReturnValueOnce(
      Effect.fail(new McpDiscoveryError({ reason: "temporarily unavailable" })),
    )
    .mockReturnValue(Effect.succeed({ issuer: "http://127.0.0.1:3901" }))
  const layer = Layer.mergeAll(
    Layer.succeed(McpAuthGateway, {
      readAuthorizationServerMetadata: discover,
    }),
    Layer.succeed(McpHostConfiguration, {
      readAuthIssuerOrigin: Effect.succeed("http://127.0.0.1:3901"),
    }),
  )
  const run: RunMcpEffect = (effect) =>
    Effect.runPromise(effect.pipe(Effect.provide(layer)))
  const routes = createMcpHttpRoutes(run)
  const request = () =>
    new Request("http://127.0.0.1:3902/mcp", { method: "POST" })
  expect((await routes.handleMcpPost(request())).status).toBe(503)
  expect((await routes.handleMcpPost(request())).status).toBe(401)
  expect((await routes.handleMcpPost(request())).status).toBe(401)
  expect(discover).toHaveBeenCalledTimes(2)
})
