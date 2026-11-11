import { describe, expect, it, vi } from "vitest"
import { Effect, Option } from "effect"
import { createFlowmarkMcpPostHandler } from "../src/http/post-handler.js"
import { resolveAgentAccessRuntime } from "../src/runtime/agent-access-runtime.js"
import { McpHostConfiguration } from "../src/ports/mcp-host-configuration.js"

const runtime = Effect.runSync(
  resolveAgentAccessRuntime({
    FLOWMARK_AGENT_ACCESS_ENABLED: "true",
    FLOWMARK_API_URL: "http://127.0.0.1:3902",
  }).pipe(
    Effect.provideService(McpHostConfiguration, {
      readAuthIssuerOrigin: Effect.succeed("http://127.0.0.1:3901"),
    }),
    Effect.map(Option.getOrThrow),
  ),
)
const handle = createFlowmarkMcpPostHandler({
  runtime,
  authorizationServerMetadata: {
    issuer: runtime.issuerOrigin,
    authorization_endpoint: `${runtime.issuerOrigin}/oauth2/authorize`,
    token_endpoint: `${runtime.issuerOrigin}/oauth2/token`,
    jwks_uri: `${runtime.issuerOrigin}/jwks`,
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["EdDSA"],
  },
})
const request = (headers: HeadersInit = {}, url = `${runtime.apiOrigin}/mcp`) =>
  new Request(url, { method: "POST", headers, body: "{}" })

describe("MCP HTTP authority before body/authentication", () => {
  it.each([
    "https://foreign.example",
    "null",
    "",
    "http://127.0.0.1:3909",
    "https://127.0.0.1:3902",
    "http://127.0.0.1:3902/path",
    "http://127.0.0.1:3902, https://foreign.example",
  ])(
    "rejects the unapproved Origin %s without reading the body or reflecting input",
    async (origin) => {
      const incoming = request({
        origin,
        authorization: "Bearer PRIVATE_TOKEN_CANARY",
      })
      const body = vi.spyOn(incoming, "body", "get")
      const response = await handle(incoming)
      expect(response.status).toBe(403)
      expect(body).not.toHaveBeenCalled()
      expect(response.headers.get("cache-control")).toBe("no-store")
      const text = await response.text()
      if (origin.length > 0) {
        expect(text).not.toContain(origin)
      }
      expect(text).not.toContain("PRIVATE_TOKEN_CANARY")
    },
  )
  it.each([
    [{ host: "rebound.example" }, undefined],
    [{ host: "attacker@127.0.0.1:3902" }, undefined],
    [{ host: "127.0.0.1:3902/path" }, undefined],
    [{ host: "127.0.0.1:3902#" }, undefined],
    [{ "x-forwarded-host": "127.0.0.1:3902" }, "http://rebound.example/mcp"],
  ] as const)(
    "rejects rebinding or malformed authority (%j)",
    async (headers, url) => {
      expect((await handle(request(headers, url))).status).toBe(403)
    },
  )
  it.each([undefined, runtime.apiOrigin, runtime.issuerOrigin])(
    "preserves native clients and configured origins (%s)",
    async (origin) => {
      const response = await handle(
        request(origin === undefined ? {} : { origin }),
      )
      expect(response.status).toBe(401)
    },
  )
})
