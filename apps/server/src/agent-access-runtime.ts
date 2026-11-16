import { resolveAgentAccessRuntime as resolveMcpAgentAccessRuntime } from "@flowmark/mcp"
import { Effect } from "effect"
import { McpHostConfigurationLive } from "./adapters/mcp/mcp-host-configuration"

export {
  agentAccessRequiredScopes,
  AgentAccessRuntimeError,
  type ResolvedAgentAccessRuntime,
} from "@flowmark/mcp"

export const resolveAgentAccessRuntime = () =>
  resolveMcpAgentAccessRuntime().pipe(Effect.provide(McpHostConfigurationLive))
