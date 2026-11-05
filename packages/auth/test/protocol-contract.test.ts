import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Cause, Effect, Exit } from "effect"
import {
  AGENT_ACCESS_MCP_TOOLS,
  AGENT_ACCESS_OAUTH_SCOPE_READ,
  AGENT_ACCESS_REFERENCE_DEPLOYMENTS,
  AgentAccessContractError,
  assertAgentAccessReadScopes,
  buildAgentAccessRouteMap,
  buildRequireMcpAuthOverrides,
  requireAgentAccessProjectId,
  resolveAgentAccessOrigins,
} from "../src/agent-access/protocol-contract.js"

const run = (effect: Effect.Effect<void, AgentAccessContractError>) =>
  Effect.runPromiseExit(effect)

const expectFail = async (
  effect: Effect.Effect<unknown, AgentAccessContractError>,
) => {
  const exit = await run(effect as Effect.Effect<void, AgentAccessContractError>)
  assert.equal(Exit.isFailure(exit), true)
  if (Exit.isFailure(exit)) {
    const failed = exit.cause.reasons.find(Cause.isFailReason)
    assert.ok(failed?.error._tag === "AgentAccessContractError")
  }
}

describe("Agent TASK-001.2 protocol contract", () => {
  it("maps reference deployments to distinct issuer and API resource URLs", () => {
    const production = buildAgentAccessRouteMap(
      AGENT_ACCESS_REFERENCE_DEPLOYMENTS.production,
    )
    assert.equal(production.issuerOrigin, "https://app.flowmark.dev")
    assert.equal(production.apiOrigin, "https://api.flowmark.dev")
    assert.equal(production.mcpResourceUrl, "https://api.flowmark.dev/mcp")
    assert.notEqual(production.issuerOrigin, production.apiOrigin)

    const staging = buildRequireMcpAuthOverrides(
      AGENT_ACCESS_REFERENCE_DEPLOYMENTS.staging,
    )
    assert.equal(staging.issuer, "https://app.staging.flowmark.dev")
    assert.equal(staging.resource, "https://api.staging.flowmark.dev/mcp")
    assert.equal(staging.jwksUrl, "https://app.staging.flowmark.dev/jwks")
    assert.deepEqual(staging.requiredScopes, [AGENT_ACCESS_OAUTH_SCOPE_READ])
  })

  it("requires projectId on project-scoped tools but not on get_connection", async () => {
    assert.equal(
      Exit.isSuccess(
        await run(requireAgentAccessProjectId("get_connection", undefined)),
      ),
      true,
    )
    await expectFail(requireAgentAccessProjectId("find_runs", ""))
    assert.equal(
      Exit.isSuccess(await run(requireAgentAccessProjectId("find_runs", "proj_abc"))),
      true,
    )
  })

  it("rejects origins with paths or credentials", async () => {
    await expectFail(
      resolveAgentAccessOrigins({
        dashboardOrigin: "https://app.example/extra",
        apiOrigin: "https://api.example",
      }),
    )
  })

  it("freezes exactly six public tool names", () => {
    assert.equal(AGENT_ACCESS_MCP_TOOLS.length, 6)
    assert.equal(new Set(AGENT_ACCESS_MCP_TOOLS).size, 6)
  })

  it("fails closed when the read scope is missing", async () => {
    await expectFail(assertAgentAccessReadScopes(new Set(["openid"])))
  })
})
