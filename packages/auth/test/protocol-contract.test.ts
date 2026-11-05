import assert from "node:assert/strict"
import { describe, it } from "node:test"
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

  it("requires projectId on project-scoped tools but not on get_connection", () => {
    assert.doesNotThrow(() =>
      requireAgentAccessProjectId("get_connection", undefined),
    )
    assert.throws(
      () => requireAgentAccessProjectId("find_runs", ""),
      AgentAccessContractError,
    )
    assert.doesNotThrow(() =>
      requireAgentAccessProjectId("find_runs", "proj_abc"),
    )
  })

  it("rejects origins with paths or credentials", () => {
    assert.throws(
      () =>
        resolveAgentAccessOrigins({
          dashboardOrigin: "https://app.example/extra",
          apiOrigin: "https://api.example",
        }),
      AgentAccessContractError,
    )
  })

  it("freezes exactly six public tool names", () => {
    assert.equal(AGENT_ACCESS_MCP_TOOLS.length, 6)
    assert.equal(new Set(AGENT_ACCESS_MCP_TOOLS).size, 6)
  })

  it("fails closed when the read scope is missing", () => {
    assert.throws(
      () => assertAgentAccessReadScopes(new Set(["openid"])),
      AgentAccessContractError,
    )
  })
})
