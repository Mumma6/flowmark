import { AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL } from "./mcp-dependency-proposal.js"

/**
 * Agent TASK-001.2 frozen protocol contract. Implementation tasks must import
 * these constants instead of redefining paths, scopes, tools or bounds.
 */
export const AGENT_ACCESS_PROTOCOL_CONTRACT = {
  adr: "docs/decisions/0008-connect-agent-protocol-contract.md",
  status: "proposed",
  dependencyAdr: AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL.adr,
  reviewedOn: "2026-11-05",
} as const

export const AGENT_ACCESS_OAUTH_SCOPE_READ = "flowmark:read" as const
export const AGENT_ACCESS_OAUTH_SCOPE_OFFLINE = "offline_access" as const

export const AGENT_ACCESS_ACCESS_TOKEN_TTL_SECONDS = 10 * 60
export const AGENT_ACCESS_REFRESH_FAMILY_MAX_DAYS = 30

export const AGENT_ACCESS_GRANT_POLICY = {
  maxProjectsPerAuthorization: 10,
  requireExplicitProjectIdOnProjectScopedTools: true,
  intersectGrantWithCurrentMembership: true,
  forbidUnrestrictedUserReaderFallback: true,
  forbidImplicitDefaultProject: true,
  revocationCheckedOnEveryAuthorizedRequest: true,
  jwtExpiryAloneIsInsufficient: true,
} as const

export const AGENT_ACCESS_CLIENT_POLICY = {
  registrationPrimary: "cimd",
  cimdMetadataProfile: "mcp-2026-07-28",
  dynamicClientRegistrationDefault: false,
  pkceRequired: true,
  codeChallengeMethod: "S256",
  treatRemoteClientMetadataAsUntrusted: true,
  noClientSecretInDistributedDesktopConfig: true,
  nativeLoopbackRedirectHosts: ["127.0.0.1", "localhost", "[::1]"] as const,
  nativeLoopbackRedirectSchemes: ["http"] as const,
  dashboardProxyExternalRedirectsDefault: false,
} as const

export const AGENT_ACCESS_MCP_TOOLS = [
  "get_connection",
  "list_workflows",
  "find_runs",
  "get_run",
  "compare_run",
  "get_workflow_insights",
] as const

export type AgentAccessMcpToolName = (typeof AGENT_ACCESS_MCP_TOOLS)[number]

export const AGENT_ACCESS_PROJECT_SCOPED_TOOLS = [
  "list_workflows",
  "find_runs",
  "get_run",
  "compare_run",
  "get_workflow_insights",
] as const satisfies ReadonlyArray<AgentAccessMcpToolName>

export const AGENT_ACCESS_QUERY_BOUNDS = {
  defaultPageSize: 25,
  maxPageSize: 100,
  defaultEventPageSize: 50,
  maxEventPageSize: 100,
  maxHistoryWindowDays: 31,
  maxInsightWindowDays: 31,
  defaultPeerLookbackDays: 30,
  maxSerializedResponseBytes: 64 * 1024,
} as const

export const AGENT_ACCESS_DASHBOARD_BROWSER_PATHS = {
  existingAuthApiPrefix: "/api/auth",
  oauthLoginPage: "/sign-in",
  oauthConsentPage: "/connect/agent/consent",
} as const

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

const ORIGIN_PATTERN = /^https?:\/\/[^/?#]+(?::\d+)?$/i

export function resolveAgentAccessOrigins(input: {
  readonly dashboardOrigin: string
  readonly apiOrigin: string
}): AgentAccessResolvedOrigins {
  const issuerOrigin = normalizeOrigin(input.dashboardOrigin, "dashboardOrigin")
  const apiOrigin = normalizeOrigin(input.apiOrigin, "apiOrigin")
  if (issuerOrigin === apiOrigin) {
    // Local dev often collapses origins; resource URL still uses explicit /mcp path.
  }
  return {
    issuerOrigin,
    apiOrigin,
    mcpResourceUrl: `${apiOrigin}/mcp`,
  }
}

export function buildAgentAccessRouteMap(
  origins: AgentAccessResolvedOrigins,
): AgentAccessRouteMap {
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

export function buildRequireMcpAuthOverrides(
  origins: AgentAccessResolvedOrigins,
): {
  readonly issuer: string
  readonly resource: string
  readonly jwksUrl: string
  readonly requiredScopes: readonly [typeof AGENT_ACCESS_OAUTH_SCOPE_READ]
} {
  return {
    issuer: origins.issuerOrigin,
    resource: origins.mcpResourceUrl,
    jwksUrl: `${origins.issuerOrigin}/jwks`,
    requiredScopes: [AGENT_ACCESS_OAUTH_SCOPE_READ],
  }
}

export function isAgentAccessProjectScopedTool(
  toolName: string,
): toolName is (typeof AGENT_ACCESS_PROJECT_SCOPED_TOOLS)[number] {
  return (AGENT_ACCESS_PROJECT_SCOPED_TOOLS as readonly string[]).includes(
    toolName,
  )
}

export class AgentAccessContractError extends Error {
  readonly _tag = "AgentAccessContractError"
  constructor(message: string) {
    super(message)
    this.name = "AgentAccessContractError"
  }
}

export function requireAgentAccessProjectId(
  toolName: AgentAccessMcpToolName,
  projectId: unknown,
): asserts projectId is string {
  if (!isAgentAccessProjectScopedTool(toolName)) {
    return
  }
  if (typeof projectId !== "string" || projectId.trim().length === 0) {
    throw new AgentAccessContractError(
      `Tool "${toolName}" requires a non-empty projectId; default-project fallback is forbidden.`,
    )
  }
}

export function assertAgentAccessReadScopes(
  grantedScopes: ReadonlySet<string>,
): void {
  if (!grantedScopes.has(AGENT_ACCESS_OAUTH_SCOPE_READ)) {
    throw new AgentAccessContractError(
      `Missing required scope "${AGENT_ACCESS_OAUTH_SCOPE_READ}".`,
    )
  }
}

export const AGENT_ACCESS_REFERENCE_DEPLOYMENTS = {
  production: resolveAgentAccessOrigins({
    dashboardOrigin: "https://app.flowmark.dev",
    apiOrigin: "https://api.flowmark.dev",
  }),
  staging: resolveAgentAccessOrigins({
    dashboardOrigin: "https://app.staging.flowmark.dev",
    apiOrigin: "https://api.staging.flowmark.dev",
  }),
  local: resolveAgentAccessOrigins({
    dashboardOrigin: "http://localhost:3001",
    apiOrigin: "http://localhost:3000",
  }),
} as const

/** Initial admission budgets (Flowmark policy). Separate MCP limiter from login. */
export const AGENT_ACCESS_ADMISSION_BUDGETS_PROVISIONAL = {
  oauthAuthorizePerTrustedSourcePerMinute: 60,
  oauthTokenPerTrustedSourcePerMinute: 120,
  mcpToolCallsPerGrantFamilyPerMinute: 120,
  unauthenticatedDiscoveryPerServicePerMinute: 300,
} as const

export const AGENT_ACCESS_DEFERRED_EMPIRICAL_CHECKS = [
  "Agent TASK-008: Codex CLI OAuth + MCP on approved endpoint",
  "Agent TASK-008: Cursor desktop Add-to-Cursor + OAuth callback",
  "Agent TASK-008: Claude Code HTTP MCP + refresh/reconnect",
  "Agent TASK-008: Custom client CIMD fetch + native loopback redirect",
  "Agent TASK-008: Cross-origin issuer proxy with external authorize redirect to loopback",
] as const

function normalizeOrigin(value: string, label: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new AgentAccessContractError(`${label} must be an absolute URL.`)
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new AgentAccessContractError(
      `${label} must not include credentials, query, or fragment.`,
    )
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    throw new AgentAccessContractError(
      `${label} must be an origin without a path.`,
    )
  }
  const origin = url.origin
  if (!ORIGIN_PATTERN.test(origin)) {
    throw new AgentAccessContractError(
      `${label} is not a valid HTTP(S) origin.`,
    )
  }
  return origin
}
