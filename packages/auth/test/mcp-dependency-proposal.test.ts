import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL } from "../src/agent-access/mcp-dependency-proposal.js"

describe("Agent TASK-001.1 MCP dependency proposal", () => {
  it("names exact proposed versions and documents the auth upgrade gap", () => {
    assert.equal(
      AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL.proposed.betterAuth,
      "1.7.17",
    )
    assert.match(
      AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL.proposed.mcpPlugin,
      /^@better-auth\/mcp@1\.7\.17$/,
    )
    assert.equal(
      AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL.proposed.mcpServerSdk,
      "@modelcontextprotocol/server@2.3.1",
    )
    assert.equal(
      AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL.proposed.betterCall,
      "1.4.5",
    )
    assert.equal(
      AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL.current.betterAuth,
      "1.7.13",
    )
    assert.equal(
      AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL.current.mcpPackagesInstalled,
      false,
    )
    assert.equal(
      AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL.current.oauthTablesInDb,
      false,
    )
  })

  it("lists oauth provider schema models and required plugins", () => {
    assert.deepEqual(
      AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL.oauthProviderSchemaModels,
      [
        "oauthClient",
        "oauthResource",
        "oauthClientResource",
        "oauthAccessToken",
        "oauthConsent",
        "oauthClientAssertion",
      ],
    )
    assert.deepEqual(
      AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL.proposed.requiredBetterAuthPlugins,
      ["jwt", "mcp", "cimd"],
    )
  })

  it("rejects bespoke issuers and beta auth lines", () => {
    assert.equal(
      AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL.rejected.bespokeTokenIssuer,
      true,
    )
    assert.equal(
      AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL.rejected.parallelOAuthProviderPlugin,
      true,
    )
    assert.match(
      AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL.rejected.betterAuthLine,
      /beta/i,
    )
  })

  it("sketches oauth2 and mcp resource paths separately", () => {
    assert.equal(
      AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL.routeSketch.oauthPrefix,
      "/oauth2",
    )
    assert.equal(
      AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL.routeSketch.mcpResourcePath,
      "/mcp",
    )
    assert.equal(
      AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL.integrationConstraints
        .requireMcpAuthIssuerOverride,
      true,
    )
    assert.match(
      AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL.protocolContractAdr,
      /0008/,
    )
    assert.equal(AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL.frozenPublicToolCount, 6)
    assert.match(
      AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL.deferredVerification,
      /008/,
    )
  })
})
