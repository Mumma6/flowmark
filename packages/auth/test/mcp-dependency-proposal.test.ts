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
      "@modelcontextprotocol/server@2.4.0",
    )
    assert.equal(
      AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL.current.betterAuth,
      "1.7.13",
    )
    assert.equal(
      AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL.current.mcpPackagesInstalled,
      false,
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
    assert.match(
      AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL.deferredVerification,
      /008/,
    )
  })
})
