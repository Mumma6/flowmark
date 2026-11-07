import { Context, Effect } from "effect"
import type { AgentAccessRuntimeError } from "../errors.js"

export interface McpHostConfigurationService {
  readonly readAuthIssuerOrigin: Effect.Effect<string, AgentAccessRuntimeError>
}

export class McpHostConfiguration extends Context.Service<
  McpHostConfiguration,
  McpHostConfigurationService
>()("@flowmark/mcp/McpHostConfiguration") {}
