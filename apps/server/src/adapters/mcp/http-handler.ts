import { createMcpProtectedRequestHandler } from "@better-auth/mcp"
import {
  GetMcpAgentConnection,
  runApi,
  type McpAgentConnectionSnapshot,
} from "@flowmark/api"
import {
  AGENT_ACCESS_OAUTH_SCOPE_READ,
  readAgentAccessGrantFamily,
} from "@flowmark/auth/agent-access"
import { createDatabase } from "@flowmark/db"
import {
  createMcpHandler,
  McpServer,
  oauthMetadataResponse,
  type AuthInfo,
  type AuthorizationServerMetadata,
} from "@modelcontextprotocol/server"
import { Effect, Exit } from "effect"
import type { ResolvedAgentAccessRuntime } from "../../agent-access-runtime"

type AccessClaims = {
  readonly sub?: unknown
  readonly client_id?: unknown
  readonly azp?: unknown
  readonly exp?: unknown
}

const oauthClientIdFromClaims = (claims: AccessClaims) => {
  const direct = claims.client_id
  if (typeof direct === "string" && direct.trim().length > 0) {
    return direct.trim()
  }
  const azp = claims.azp
  if (typeof azp === "string" && azp.trim().length > 0) {
    return azp.trim()
  }
  return undefined
}

export type FlowmarkMcpAuthInfo = {
  readonly subjectUserId: string
  readonly clientId: string
  readonly resourceUrl: string
  readonly issuer: string
}

const authInfoFromClaims = (
  runtime: ResolvedAgentAccessRuntime,
  claims: AccessClaims,
): FlowmarkMcpAuthInfo | undefined => {
  const subjectUserId = claims.sub
  const clientId = oauthClientIdFromClaims(claims)
  if (typeof subjectUserId !== "string" || !clientId) {
    return undefined
  }
  return {
    subjectUserId,
    clientId,
    resourceUrl: runtime.mcpResourceUrl,
    issuer: runtime.issuerOrigin,
  }
}

const toMcpAuthInfo = (
  identity: FlowmarkMcpAuthInfo,
  claims: AccessClaims,
  token: string,
): AuthInfo => ({
  token,
  clientId: identity.clientId,
  scopes: [AGENT_ACCESS_OAUTH_SCOPE_READ],
  expiresAt: typeof claims.exp === "number" ? claims.exp : undefined,
  extra: identity,
})

const resolveMcpConnection = Effect.fn("Mcp.resolveMcpConnection")(function* (
  runtime: ResolvedAgentAccessRuntime,
  identity: FlowmarkMcpAuthInfo,
) {
  const configuredUrl = process.env.DATABASE_URL
  if (!configuredUrl) {
    return yield* Effect.fail(new Error("Workflow data is not configured."))
  }
  const { db } = createDatabase(configuredUrl)
  const family = yield* readAgentAccessGrantFamily(db, {
    subjectUserId: identity.subjectUserId,
    clientId: identity.clientId,
    issuer: identity.issuer,
    resource: identity.resourceUrl,
  }).pipe(
    Effect.mapError(
      () =>
        new Error(
          "This connection is revoked, expired, or not authorized for this resource.",
        ),
    ),
  )
  const getMcp = yield* GetMcpAgentConnection
  return yield* getMcp
    .resolve({
      userId: identity.subjectUserId,
      clientId: identity.clientId,
      authorizationCodeId: family.familyId,
      resourceUrl: identity.resourceUrl,
      authenticatedAt: new Date(),
    })
    .pipe(
      Effect.mapError(() => new Error("Connection details could not be read.")),
    )
})

const connectionToolResult = (snapshot: McpAgentConnectionSnapshot) => ({
  content: [
    {
      type: "text" as const,
      text: JSON.stringify(snapshot),
    },
  ],
  structuredContent: snapshot,
})

const connectionToolError = (message: string) => ({
  isError: true as const,
  content: [{ type: "text" as const, text: message }],
})

const registerFlowmarkTools = (
  server: McpServer,
  runtime: ResolvedAgentAccessRuntime,
  identity: FlowmarkMcpAuthInfo,
) => {
  server.registerTool(
    "get_connection",
    {
      title: "Get connection",
      description:
        "Return the current OAuth grant, effective project scope, and which investigation tools are enabled on this deployment.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => {
      const exit = await runApi(resolveMcpConnection(runtime, identity))
      if (Exit.isFailure(exit)) {
        return connectionToolError("Connection details could not be read.")
      }
      return connectionToolResult(exit.value)
    },
  )
}

export const createFlowmarkMcpPostHandler = (input: {
  readonly runtime: ResolvedAgentAccessRuntime
  readonly authorizationServerMetadata: AuthorizationServerMetadata
}) => {
  let cachedMcpSdk: ReturnType<typeof createMcpHandler> | undefined
  const mcpSdkHandler = () => {
    if (!cachedMcpSdk) {
      cachedMcpSdk = createMcpHandler(
        async (ctx) => {
          const identity = ctx.authInfo?.extra as
            FlowmarkMcpAuthInfo | undefined
          if (!identity) {
            throw new Error("Agent access context is missing.")
          }
          const server = new McpServer(
            { name: "flowmark", version: "0.1.0" },
            { capabilities: { tools: {} } },
          )
          registerFlowmarkTools(server, input.runtime, identity)
          return server
        },
        { legacy: "reject" },
      )
    }
    return cachedMcpSdk
  }
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
