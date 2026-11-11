import { Effect, Layer, Result } from "effect"
import { describe, expect, it } from "vitest"
import { PersistenceError } from "../../src/errors.js"
import { DelegatedAccessRepository } from "../../src/features/project-access/ports/delegated-access-repository.js"
import { AuthorizeAgentRead } from "../../src/features/project-access/use-cases/authorize-agent-read.js"
import {
  GetMcpAgentConnection,
  GetMcpAgentConnectionLive,
} from "../../src/features/project-access/use-cases/get-mcp-agent-connection.js"

const selection = {
  subjectUserId: "user",
  clientId: "client",
  authorizationCodeId: "family",
  resource: "https://api.example.test/mcp",
}
const repository = (
  overrides: Partial<typeof DelegatedAccessRepository.Service> = {},
) =>
  Layer.succeed(DelegatedAccessRepository, {
    grantFamily: () => Effect.succeed("family"),
    connection: () => Effect.succeed(undefined),
    recordAuthenticated: () => Effect.void,
    consumeBudget: () => Effect.succeed({ allowed: true, retryAfter: null }),
    ...overrides,
  })
const grant = AuthorizeAgentRead.use((access) => access.grantFamily(selection))

describe("delegated read use cases", () => {
  it("rejects absent/revoked families without manufacturing authority", async () => {
    const result = await Effect.runPromise(
      grant.pipe(
        Effect.provide(
          AuthorizeAgentRead.layer.pipe(
            Layer.provide(
              repository({ grantFamily: () => Effect.succeed(undefined) }),
            ),
          ),
        ),
        Effect.result,
      ),
    )
    Result.match(result, {
      onSuccess: () => expect.fail("Absent family must be denied"),
      onFailure: (error) => expect(error._tag).toBe("Unauthorized"),
    })
  })
  it("preserves persistence failures and exact signed selections", async () => {
    const failure = new PersistenceError({
      operation: "grant-family",
      cause: "private",
    })
    const result = await Effect.runPromise(
      grant.pipe(
        Effect.provide(
          AuthorizeAgentRead.layer.pipe(
            Layer.provide(
              repository({
                grantFamily: (input) => {
                  expect(input).toEqual(selection)
                  return Effect.fail(failure)
                },
              }),
            ),
          ),
        ),
        Effect.flip,
      ),
    )
    expect(result).toBe(failure)
  })
  it("keeps durable exhaustion as an explicit decision with retry policy", async () => {
    const decision = await Effect.runPromise(
      AuthorizeAgentRead.use((access) =>
        access.consumeBudget("grant:family", 10),
      ).pipe(
        Effect.provide(
          AuthorizeAgentRead.layer.pipe(
            Layer.provide(
              repository({
                consumeBudget: (scope, maximum) => {
                  expect([scope, maximum]).toEqual(["grant:family", 10])
                  return Effect.succeed({ allowed: false, retryAfter: 23 })
                },
              }),
            ),
          ),
        ),
      ),
    )
    expect(decision).toEqual({ allowed: false, retryAfter: 23 })
  })
  it("observes authentication only after an active connection was read", async () => {
    const observed: string[] = []
    const input = {
      userId: "user",
      clientId: "client",
      authorizationCodeId: "family",
      resourceUrl: selection.resource,
      authenticatedAt: new Date("2026-11-11T00:00:00Z"),
    }
    const live = GetMcpAgentConnectionLive.pipe(
      Layer.provide(
        repository({
          connection: () =>
            Effect.sync(() => {
              observed.push("connection")
              return {
                clientId: "client",
                authorizationCodeId: "family",
                clientName: "test",
                projects: [{ id: "project", name: "Project" }],
              }
            }),
          recordAuthenticated: (value) =>
            Effect.sync(() => {
              expect(value.at).toBe(input.authenticatedAt)
              observed.push("authenticated")
            }),
        }),
      ),
    )
    const result = await Effect.runPromise(
      GetMcpAgentConnection.use((service) => service.resolve(input)).pipe(
        Effect.provide(live),
      ),
    )
    expect(observed).toEqual(["connection", "authenticated"])
    expect(result.projects).toEqual([{ id: "project", name: "Project" }])
    expect(result.readScope).toBe("flowmark:read")
  })
})
