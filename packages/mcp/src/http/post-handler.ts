import { createMcpProtectedRequestHandler } from "@better-auth/mcp"
import type { AuthorizationServerMetadata } from "@modelcontextprotocol/server"
import { Option } from "effect"
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
      const bearer = request.headers.get("authorization")
      const token = Option.fromNullishOr(
        bearer?.startsWith("Bearer ")
          ? bearer.slice("Bearer ".length).trim()
          : undefined,
      ).pipe(Option.filter((value) => value.length > 0))
      return Option.match(
        Option.all({
          identity: Option.fromNullishOr(
            authInfoFromClaims(input.runtime, claims),
          ),
          token,
        }),
        {
          onNone: () =>
            Response.json(
              { message: "Access token is not a valid agent connection." },
              { status: 401, headers: { "cache-control": "no-store" } },
            ),
          onSome: ({ identity, token: accessToken }) =>
            mcpSdkHandler().fetch(request, {
              authInfo: toMcpAuthInfo(identity, claims, accessToken),
            }),
        },
      )
    },
  )
}
