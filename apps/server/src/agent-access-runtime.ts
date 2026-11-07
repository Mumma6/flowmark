import { resolveAgentAccessRuntime as resolveMcpAgentAccessRuntime } from "@flowmark/mcp"
import { Effect } from "effect"
import { McpHostConfigurationLive } from "./adapters/mcp/mcp-layers"

export {
  agentAccessDisabledResponse,
  agentAccessRequiredScopes,
  AgentAccessRuntimeError,
  type ResolvedAgentAccessRuntime,
} from "@flowmark/mcp"

export const resolveAgentAccessRuntime = () =>
  resolveMcpAgentAccessRuntime().pipe(Effect.provide(McpHostConfigurationLive))
