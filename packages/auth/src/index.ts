export {
  AuthConfigurationError,
  createFlowmarkAuth,
  readAuthSecret,
  type FlowmarkAuth,
} from "./create-auth.js"

export { createAuthEmailCallbacks } from "./email-callbacks.js"

export { AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL } from "./agent-access/mcp-dependency-proposal.js"
export {
  AGENT_ACCESS_PROTOCOL_CONTRACT,
  AGENT_ACCESS_MCP_TOOLS,
  AGENT_ACCESS_OAUTH_SCOPE_READ,
  AGENT_ACCESS_QUERY_BOUNDS,
  AGENT_ACCESS_GRANT_POLICY,
  buildAgentAccessRouteMap,
  buildRequireMcpAuthOverrides,
  requireAgentAccessProjectId,
  resolveAgentAccessOrigins,
  type AgentAccessMcpToolName,
  type AgentAccessResolvedOrigins,
  type AgentAccessRouteMap,
} from "./agent-access/protocol-contract.js"
