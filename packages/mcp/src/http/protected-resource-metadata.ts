import { AGENT_ACCESS_OAUTH_SCOPE_READ } from "@flowmark/auth/agent-access"
import {
  oauthMetadataResponse,
  type AuthorizationServerMetadata,
} from "@modelcontextprotocol/server"
import type { ResolvedAgentAccessRuntime } from "../runtime/agent-access-runtime.js"

export const serveMcpProtectedResourceMetadata = (
  request: Request,
  runtime: ResolvedAgentAccessRuntime,
  authorizationServerMetadata: AuthorizationServerMetadata,
) =>
  oauthMetadataResponse(request, {
    oauthMetadata: authorizationServerMetadata,
    resourceServerUrl: new URL(runtime.mcpResourceUrl),
    scopesSupported: [AGENT_ACCESS_OAUTH_SCOPE_READ],
    resourceName: "Flowmark",
  })
