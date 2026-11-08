import { AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL } from "./mcp-dependency-proposal.js"

/** Frozen ADR 0008 policy and route constants — compile-time contract only. */
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
  oauthLoginPage: "/connect/agent/sign-in",
  oauthConsentPage: "/connect/agent/consent",
} as const

/** TASK-005.5 policy; fixed counters use PostgreSQL time across all instances. */
export const AGENT_ACCESS_EXECUTION_BOUNDS = {
  maxRequestBytes: 64 * 1024,
  toolTimeoutMs: 15_000,
  statementTimeoutMs: 5_000,
  toolCallsPerServicePerMinute: 3000,
  toolCallsPerProjectPerMinute: 600,
  toolCallsPerGrantPerMinute: 120,
  discoveryPerServicePerMinute: 300,
} as const

/** Issuer paths the dashboard proxy forwards onto the API auth handler. */
export const AGENT_ACCESS_ISSUER_PROXY_PATHS = {
  authorizationServerMetadata: "/.well-known/oauth-authorization-server",
  openIdConfiguration: "/.well-known/openid-configuration",
  jwks: "/jwks",
  oauthPrefix: "/oauth2",
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
