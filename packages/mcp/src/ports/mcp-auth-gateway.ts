import { Context, Effect } from "effect"
import type { AuthorizationServerMetadata } from "@modelcontextprotocol/server"
import type { McpDiscoveryError } from "../errors.js"

export interface McpAuthGatewayService {
  readonly readAuthorizationServerMetadata: (
    issuerOrigin: string,
  ) => Effect.Effect<AuthorizationServerMetadata, McpDiscoveryError>
}

export class McpAuthGateway extends Context.Service<
  McpAuthGateway,
  McpAuthGatewayService
>()("@flowmark/mcp/McpAuthGateway") {}
