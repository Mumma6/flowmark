import { McpHostConfiguration } from "@flowmark/mcp"
import { Effect, Option, Result } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"
import { McpHostConfigurationLive } from "../src/adapters/mcp/mcp-host-configuration"
import { resolveAgentAccessRuntime } from "../src/agent-access-runtime"

afterEach(() => vi.unstubAllEnvs())

const readIssuer = McpHostConfiguration.use(
  (configuration) => configuration.readAuthIssuerOrigin,
).pipe(Effect.provide(McpHostConfigurationLive))

describe("MCP configuration composition", () => {
  it("acquires the configuration without evaluating its origin or acquiring auth", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("VERCEL_ENV", "production")
    vi.stubEnv("BETTER_AUTH_URL", undefined)
    vi.stubEnv("FLOWMARK_DASHBOARD_ORIGIN", undefined)
    vi.stubEnv("DATABASE_URL", undefined)
    vi.stubEnv("BETTER_AUTH_SECRET", undefined)

    const configuration = await Effect.runPromise(
      McpHostConfiguration.pipe(Effect.provide(McpHostConfigurationLive)),
    )
    expect(Effect.isEffect(configuration.readAuthIssuerOrigin)).toBe(true)

    const result = await Effect.runPromise(readIssuer.pipe(Effect.result))
    Result.match(result, {
      onSuccess: () => expect.fail("Missing hosted origins must fail"),
      onFailure: (error) => {
        expect(error._tag).toBe("AgentAccessRuntimeError")
        expect(error.reason).toBe(
          "FLOWMARK_DASHBOARD_ORIGIN is required in hosted environments.",
        )
      },
    })
  })

  it("reads current configuration on execution and keeps the issuer mapping", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("VERCEL_ENV", "")
    vi.stubEnv("FLOWMARK_DASHBOARD_ORIGIN", "http://localhost:3001")
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3001")

    expect(await Effect.runPromise(readIssuer)).toBe("http://localhost:3001")
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3011")
    expect(await Effect.runPromise(readIssuer)).toBe("http://localhost:3011")
  })

  it("leaves disabled agent access independent of hosted origin and auth configuration", async () => {
    vi.stubEnv("FLOWMARK_AGENT_ACCESS_ENABLED", "false")
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("VERCEL_ENV", "production")
    vi.stubEnv("BETTER_AUTH_URL", undefined)
    vi.stubEnv("FLOWMARK_DASHBOARD_ORIGIN", undefined)
    vi.stubEnv("DATABASE_URL", undefined)
    vi.stubEnv("BETTER_AUTH_SECRET", undefined)

    expect(
      Option.isNone(await Effect.runPromise(resolveAgentAccessRuntime())),
    ).toBe(true)
  })

  it("resolves enabled agent origins without constructing the auth provider", async () => {
    vi.stubEnv("FLOWMARK_AGENT_ACCESS_ENABLED", "true")
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("VERCEL_ENV", "production")
    vi.stubEnv("BETTER_AUTH_URL", "https://studio.example.test")
    vi.stubEnv("FLOWMARK_DASHBOARD_ORIGIN", "https://studio.example.test")
    vi.stubEnv("FLOWMARK_API_URL", "https://api.example.test")
    vi.stubEnv("DATABASE_URL", undefined)
    vi.stubEnv("BETTER_AUTH_SECRET", undefined)

    Option.match(await Effect.runPromise(resolveAgentAccessRuntime()), {
      onNone: () => expect.fail("Agent access is enabled"),
      onSome: (runtime) => {
        expect(runtime.issuerOrigin).toBe("https://studio.example.test")
        expect(runtime.mcpResourceUrl).toBe("https://api.example.test/mcp")
      },
    })
  })
})
