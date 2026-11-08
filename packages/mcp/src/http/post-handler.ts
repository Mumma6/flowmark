import { createMcpProtectedRequestHandler } from "@better-auth/mcp"
import type { AuthorizationServerMetadata } from "@modelcontextprotocol/server"
import { Effect, Option } from "effect"
import { McpRequestBodyError, readMcpRequest } from "./request-body.js"
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
  const handle = createMcpProtectedRequestHandler(
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
  return (request: Request) =>
    Effect.runPromise(
      readMcpRequest(request).pipe(
        Effect.timeoutOrElse({
          duration: 15000,
          orElse: () => Effect.fail(new McpRequestBodyError({ status: 408 })),
        }),
        Effect.flatMap((bounded) => Effect.promise(() => handle(bounded))),
        Effect.catchTag("McpRequestBodyError", (error) =>
          Effect.succeed(
            Response.json(
              {
                message:
                  error.status === 413
                    ? "MCP request exceeds the byte limit."
                    : "Invalid MCP request body.",
              },
              {
                status: error.status,
                headers: { "cache-control": "no-store" },
              },
            ),
          ),
        ),
      ),
      { signal: request.signal },
    )
}
