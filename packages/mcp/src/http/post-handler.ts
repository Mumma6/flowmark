import { createMcpProtectedRequestHandler } from "@better-auth/mcp"
import type { AuthorizationServerMetadata } from "@modelcontextprotocol/server"
import { authInfoFromClaims, toMcpAuthInfo } from "../auth/claims.js"
import { createFlowmarkMcpSdkHandler } from "../features/connection/register-tools.js"
import type { ResolvedAgentAccessRuntime } from "../runtime/agent-access-runtime.js"

export const createFlowmarkMcpPostHandler = (input: {
  readonly runtime: ResolvedAgentAccessRuntime
  readonly authorizationServerMetadata: AuthorizationServerMetadata
}) => {
  const mcpSdkHandler = createFlowmarkMcpSdkHandler(input.runtime)
  void input.authorizationServerMetadata
  const overrides = input.runtime.mcpAuth
  return createMcpProtectedRequestHandler(
    {
      issuer: overrides.issuer,
      audience: overrides.resource,
      jwksUrl: overrides.jwksUrl,
      requiredScopes: [...overrides.requiredScopes],
    },
    async (request, claims) => {
      const identity = authInfoFromClaims(input.runtime, claims)
      const bearer = request.headers.get("authorization")
      const token = bearer?.startsWith("Bearer ")
        ? bearer.slice("Bearer ".length).trim()
        : undefined
      if (!identity || !token) {
        return Response.json(
          { message: "Access token is not a valid agent connection." },
          { status: 401, headers: { "cache-control": "no-store" } },
        )
      }
      return mcpSdkHandler().fetch(request, {
        authInfo: toMcpAuthInfo(identity, claims, token),
      })
    },
  )
}
