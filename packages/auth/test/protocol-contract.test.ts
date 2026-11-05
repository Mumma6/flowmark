import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Cause, Effect, Exit, Schema } from "effect"
import {
  AGENT_ACCESS_MCP_TOOLS,
  AGENT_ACCESS_OAUTH_SCOPE_READ,
  AGENT_ACCESS_QUERY_BOUNDS,
  AGENT_ACCESS_REFERENCE_DEPLOYMENTS,
  AgentAccessContractError,
  AgentAccessMcpToolNameSchema,
  assertAgentAccessReadScopes,
  buildAgentAccessRouteMap,
  buildRequireMcpAuthOverrides,
  decodeAgentAccessMcpToolName,
  decodeAgentAccessPageSize,
  requireAgentAccessProjectId,
  resolveAgentAccessOrigins,
} from "../src/agent-access/index.js"

const runContract = <A>(effect: Effect.Effect<A, AgentAccessContractError>) =>
  Effect.runPromiseExit(effect)

const expectFailure = async <A>(
  effect: Effect.Effect<A, AgentAccessContractError>,
) => {
  const exit = await runContract(effect)
  assert.equal(Exit.isFailure(exit), true)
  if (Exit.isFailure(exit)) {
    const failed = exit.cause.reasons.find(Cause.isFailReason)
    assert.equal(failed?.error._tag, "AgentAccessContractError")
    return failed!.error
  }
  throw new Error("unreachable")
}

const expectSuccess = async <A>(
  effect: Effect.Effect<A, AgentAccessContractError>,
) => {
  const exit = await runContract(effect)
  assert.equal(Exit.isSuccess(exit), true)
  if (Exit.isSuccess(exit)) {
    return exit.value
  }
  throw new Error("unreachable")
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
    await expectSuccess(
      requireAgentAccessProjectId("get_connection", undefined),
    )
    const missingProject = await expectFailure(
      requireAgentAccessProjectId("find_runs", ""),
    )
    assert.match(missingProject.reason, /projectId/)
    await expectSuccess(requireAgentAccessProjectId("find_runs", "proj_abc"))
  })

  it("rejects unknown tool names at the contract boundary", async () => {
    const error = await expectFailure(
      decodeAgentAccessMcpToolName("delete_everything"),
    )
    assert.match(error.reason, /tool name/i)
  })

  it("rejects origins with paths or credentials", async () => {
    await expectFailure(
      resolveAgentAccessOrigins({
        dashboardOrigin: "https://app.example/extra",
        apiOrigin: "https://api.example",
      }),
    )
  })

  it("keeps Schema tool literals aligned with the frozen public tool list", () => {
    for (const tool of AGENT_ACCESS_MCP_TOOLS) {
      assert.equal(
        Schema.decodeUnknownSync(AgentAccessMcpToolNameSchema)(tool),
        tool,
      )
    }
    assert.throws(() =>
      Schema.decodeUnknownSync(AgentAccessMcpToolNameSchema)("not_a_tool"),
    )
  })

  it("freezes exactly six public tool names", () => {
    assert.equal(AGENT_ACCESS_MCP_TOOLS.length, 6)
    assert.equal(new Set(AGENT_ACCESS_MCP_TOOLS).size, 6)
  })

  it("fails closed when the read scope is missing", async () => {
    const error = await expectFailure(
      assertAgentAccessReadScopes(new Set(["openid"])),
    )
    assert.match(error.reason, /flowmark:read/)
  })

  it("bounds page sizes through Schema decode", async () => {
    assert.equal(await expectSuccess(decodeAgentAccessPageSize(25)), 25)
    await expectFailure(decodeAgentAccessPageSize(101))
    await expectFailure(
      decodeAgentAccessPageSize(AGENT_ACCESS_QUERY_BOUNDS.maxPageSize + 1),
    )
  })
})
