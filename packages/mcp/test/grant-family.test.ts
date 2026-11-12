import { describe, expect, it, vi } from "vitest"
import { AuthorizeAgentRead, PersistenceError } from "@flowmark/api"
import { Deferred, Effect, Exit, Layer } from "effect"
import { resolveMcpGrantFamily } from "../src/features/delegated/grant-family.js"
import { McpConnectionResolveError } from "../src/errors.js"

const identity = {
  subjectUserId: "user",
  clientId: "client",
  authorizationCodeId: "signed-family",
  issuer: "https://studio.example.test",
  resourceUrl: "https://api.example.test/mcp",
}
const access = (grantFamily: typeof AuthorizeAgentRead.Service.grantFamily) =>
  AuthorizeAgentRead.of({
    grantFamily,
    consumeBudget: () => Effect.succeed({ allowed: true, retryAfter: null }),
  })

describe("MCP delegated-read capability", () => {
  it("passes the exact signed family and resource to the API", async () => {
    const grantFamily = vi.fn(() =>
      Effect.succeed({ familyId: "signed-family" }),
    )
    expect(
      await Effect.runPromise(
        resolveMcpGrantFamily(identity).pipe(
          Effect.provideService(AuthorizeAgentRead, access(grantFamily)),
        ),
      ),
    ).toEqual({ familyId: "signed-family" })
    expect(grantFamily).toHaveBeenCalledWith({
      subjectUserId: "user",
      clientId: "client",
      authorizationCodeId: "signed-family",
      resource: identity.resourceUrl,
    })
  })
  it("preserves an unavailable-read cause while masking outward detail", async () => {
    const failure = new PersistenceError({
      operation: "grant-family",
      cause: "private failure",
    })
    const error = await Effect.runPromise(
      resolveMcpGrantFamily(identity).pipe(
        Effect.provideService(
          AuthorizeAgentRead,
          access(() => Effect.fail(failure)),
        ),
        Effect.flip,
      ),
    )
    expect(error).toBeInstanceOf(McpConnectionResolveError)
    expect(error.cause).toBe(failure)
    expect(error.reason).not.toContain("private failure")
  })
  it("keeps the injected capability in its caller's interrupted scope", async () => {
    const started = Deferred.makeUnsafe<void>()
    const released = vi.fn()
    const layer = Layer.effect(
      AuthorizeAgentRead,
      Effect.acquireRelease(
        Effect.succeed(
          access(() =>
            Deferred.succeed(started, undefined).pipe(
              Effect.andThen(Effect.never),
            ),
          ),
        ),
        () => Effect.sync(released),
      ),
    )
    const controller = new AbortController()
    const pending = Effect.runPromiseExit(
      resolveMcpGrantFamily(identity).pipe(Effect.provide(layer)),
      { signal: controller.signal },
    )
    await Effect.runPromise(Deferred.await(started))
    controller.abort()
    expect(Exit.isFailure(await pending)).toBe(true)
    expect(released).toHaveBeenCalledOnce()
  })
})
