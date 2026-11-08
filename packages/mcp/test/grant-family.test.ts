import { afterEach, describe, expect, it, vi } from "vitest"
import { Deferred, Effect, Exit } from "effect"
import { readAgentAccessGrantFamily } from "@flowmark/auth/agent-access"
import { resolveMcpGrantFamily } from "../src/features/delegated/grant-family.js"
import { McpConnectionResolveError } from "../src/errors.js"

const resources = vi.hoisted(() => ({ acquired: vi.fn(), released: vi.fn() }))

vi.mock("@flowmark/auth/agent-access", () => ({
  readAgentAccessGrantFamily: vi.fn(),
}))
vi.mock("@flowmark/api", async () => {
  const { Effect, Layer } = await import("effect")
  const { Database } = await import("@flowmark/db/persistence")
  return {
    ApiSettings: { layer: Layer.empty },
    DatabaseLive: Layer.effect(
      Database,
      Effect.acquireRelease(
        Effect.sync(() => {
          resources.acquired()
          return {} as typeof Database.Service
        }),
        () => Effect.sync(() => resources.released()),
      ),
    ),
  }
})

const identity = {
  subjectUserId: "user",
  clientId: "client",
  authorizationCodeId: "signed-family",
  issuer: "https://studio.example.test",
  resourceUrl: "https://api.example.test/mcp",
}

afterEach(() => vi.clearAllMocks())

describe("MCP grant database lifetime", () => {
  it("checks the signed family and releases its connection after success", async () => {
    vi.mocked(readAgentAccessGrantFamily).mockReturnValue(
      Effect.succeed({
        familyId: identity.authorizationCodeId,
        subjectUserId: identity.subjectUserId,
        clientId: identity.clientId,
        issuer: identity.issuer,
        resource: identity.resourceUrl,
      }),
    )
    expect(await Effect.runPromise(resolveMcpGrantFamily(identity))).toEqual({
      familyId: "signed-family",
    })
    expect(readAgentAccessGrantFamily).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ authorizationCodeId: "signed-family" }),
    )
    expect(resources.acquired).toHaveBeenCalledTimes(1)
    expect(resources.released).toHaveBeenCalledTimes(1)
  })

  it("releases its connection and retains the cause when the read fails", async () => {
    const { AgentAccessContractError } = await vi.importActual<
      typeof import("@flowmark/auth/agent-access")
    >("@flowmark/auth/agent-access")
    const failure = new AgentAccessContractError({
      reason: "storage unavailable",
    })
    vi.mocked(readAgentAccessGrantFamily).mockReturnValue(Effect.fail(failure))
    const error = await Effect.runPromise(
      resolveMcpGrantFamily(identity).pipe(Effect.flip),
    )
    expect(error).toBeInstanceOf(McpConnectionResolveError)
    expect(error.cause).toBe(failure)
    expect(resources.released).toHaveBeenCalledTimes(1)
  })
  it("releases its connection when an in-flight read is interrupted", async () => {
    const started = Deferred.makeUnsafe<void>()
    const controller = new AbortController()
    vi.mocked(readAgentAccessGrantFamily).mockReturnValue(
      Deferred.succeed(started, undefined).pipe(Effect.andThen(Effect.never)),
    )
    const pending = Effect.runPromiseExit(resolveMcpGrantFamily(identity), {
      signal: controller.signal,
    })
    await Effect.runPromise(Deferred.await(started))
    controller.abort()
    expect(Exit.isFailure(await pending)).toBe(true)
    expect(resources.released).toHaveBeenCalledTimes(1)
  })
})
