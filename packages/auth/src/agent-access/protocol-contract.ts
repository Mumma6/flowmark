import { Array as Arr, Effect, Schema } from "effect"
import {
  AGENT_ACCESS_OAUTH_SCOPE_READ,
  AGENT_ACCESS_PROJECT_SCOPED_TOOLS,
  type AgentAccessMcpToolName,
} from "./protocol-constants.js"
import { AgentAccessContractError } from "./contract-errors.js"
import { decodeAgentAccessMcpToolName } from "./protocol-schemas.js"

export { AgentAccessContractError } from "./contract-errors.js"
export * from "./protocol-constants.js"
export * from "./protocol-schemas.js"

export interface AgentAccessResolvedOrigins {
  readonly issuerOrigin: string
  readonly apiOrigin: string
  readonly mcpResourceUrl: string
}

export interface AgentAccessRouteMap {
  readonly issuerOrigin: string
  readonly apiOrigin: string
  readonly mcpResourceUrl: string
  readonly mcpHttpPostPath: "/mcp"
  readonly protectedResourceMetadataPath: "/.well-known/oauth-protected-resource"
  readonly authorizationServerMetadataPath: "/.well-known/oauth-authorization-server"
  readonly openIdConfigurationPath: "/.well-known/openid-configuration"
  readonly jwksPath: "/jwks"
  readonly oauthPrefix: "/oauth2"
  readonly oauthAuthorizePath: "/oauth2/authorize"
  readonly oauthTokenPath: "/oauth2/token"
  readonly oauthIntrospectPath: "/oauth2/introspect"
  readonly oauthRevokePath: "/oauth2/revoke"
  readonly oauthUserInfoPath: "/oauth2/userinfo"
  readonly dashboardProxyForwardPrefixes: readonly string[]
}

const HttpOrigin = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter((value) => {
      try {
        const url = new URL(value)
        return (
          (url.protocol === "https:" || url.protocol === "http:") &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash &&
          url.pathname === "/"
        )
      } catch {
        return false
      }
    }),
  ),
)

const readOrigin = Effect.fn("AgentAccess.readOrigin")(function* (
  label: string,
  value: string,
) {
  yield* Schema.decodeUnknownEffect(HttpOrigin)(value).pipe(
    Effect.mapError(
      () =>
        new AgentAccessContractError({
          reason: `${label} must be an HTTP(S) origin without credentials, path, query, or fragment.`,
        }),
    ),
  )
  return new URL(value).origin
})

export const resolveAgentAccessOrigins = Effect.fn(
  "AgentAccess.resolveOrigins",
)(function* (input: {
  readonly dashboardOrigin: string
  readonly apiOrigin: string
}) {
  const issuerOrigin = yield* readOrigin(
    "dashboardOrigin",
    input.dashboardOrigin,
  )
  const apiOrigin = yield* readOrigin("apiOrigin", input.apiOrigin)
  return {
    issuerOrigin,
    apiOrigin,
    mcpResourceUrl: `${apiOrigin}/mcp`,
  } satisfies AgentAccessResolvedOrigins
})

export const buildAgentAccessRouteMap = (
  origins: AgentAccessResolvedOrigins,
): AgentAccessRouteMap => {
  const { issuerOrigin, apiOrigin, mcpResourceUrl } = origins
  return {
    issuerOrigin,
    apiOrigin,
    mcpResourceUrl,
    mcpHttpPostPath: "/mcp",
    protectedResourceMetadataPath: "/.well-known/oauth-protected-resource",
    authorizationServerMetadataPath: "/.well-known/oauth-authorization-server",
    openIdConfigurationPath: "/.well-known/openid-configuration",
    jwksPath: "/jwks",
    oauthPrefix: "/oauth2",
    oauthAuthorizePath: "/oauth2/authorize",
    oauthTokenPath: "/oauth2/token",
    oauthIntrospectPath: "/oauth2/introspect",
    oauthRevokePath: "/oauth2/revoke",
    oauthUserInfoPath: "/oauth2/userinfo",
    dashboardProxyForwardPrefixes: [
      "/api/auth",
      "/oauth2",
      "/.well-known/oauth-authorization-server",
      "/.well-known/openid-configuration",
      "/jwks",
    ],
  }
}

export const buildRequireMcpAuthOverrides = (
  origins: AgentAccessResolvedOrigins,
): {
  readonly issuer: string
  readonly resource: string
  readonly jwksUrl: string
  readonly requiredScopes: readonly [typeof AGENT_ACCESS_OAUTH_SCOPE_READ]
} => ({
  issuer: origins.issuerOrigin,
  resource: origins.mcpResourceUrl,
  jwksUrl: `${origins.issuerOrigin}/jwks`,
  requiredScopes: [AGENT_ACCESS_OAUTH_SCOPE_READ],
})

export const isAgentAccessProjectScopedTool = (
  toolName: AgentAccessMcpToolName,
): boolean => Arr.contains(AGENT_ACCESS_PROJECT_SCOPED_TOOLS, toolName)

export const requireAgentAccessProjectId = Effect.fn(
  "AgentAccess.requireProjectId",
)(function* (toolName: unknown, projectId: unknown) {
  const decodedTool = yield* decodeAgentAccessMcpToolName(toolName)
  if (!isAgentAccessProjectScopedTool(decodedTool)) {
    return
  }
  if (typeof projectId !== "string" || projectId.trim().length === 0) {
    return yield* new AgentAccessContractError({
      reason: `Tool "${decodedTool}" requires a non-empty projectId; default-project fallback is forbidden.`,
    })
  }
})

export const assertAgentAccessReadScopes = Effect.fn(
  "AgentAccess.assertReadScopes",
)(function* (grantedScopes: ReadonlySet<string>) {
  if (!grantedScopes.has(AGENT_ACCESS_OAUTH_SCOPE_READ)) {
    return yield* new AgentAccessContractError({
      reason: `Missing required scope "${AGENT_ACCESS_OAUTH_SCOPE_READ}".`,
    })
  }
})

const referenceDeployment = (input: {
  readonly dashboardOrigin: string
  readonly apiOrigin: string
}) => Effect.runSync(resolveAgentAccessOrigins(input))

export const AGENT_ACCESS_REFERENCE_DEPLOYMENTS = {
  production: referenceDeployment({
    dashboardOrigin: "https://app.flowmark.dev",
    apiOrigin: "https://api.flowmark.dev",
  }),
  staging: referenceDeployment({
    dashboardOrigin: "https://app.staging.flowmark.dev",
    apiOrigin: "https://api.staging.flowmark.dev",
  }),
  local: referenceDeployment({
    dashboardOrigin: "http://localhost:3001",
    apiOrigin: "http://localhost:3000",
  }),
} as const
