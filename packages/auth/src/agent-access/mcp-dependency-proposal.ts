/**
 * Agent TASK-001.1 decision record. Packages listed here are **not installed**
 * until a maintainer approves the tranche in ADR 0007.
 */
export const AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL = {
  adr: "docs/decisions/0007-connect-agent-mcp-dependencies.md",
  status: "proposed",
  reviewedOn: "2026-11-05",
  current: {
    betterAuth: "1.7.13",
    drizzleAdapter: "1.7.13",
    drizzleOrm: "0.44.x",
    mcpPackagesInstalled: false,
  },
  proposed: {
    betterAuth: "1.7.17",
    drizzleAdapter: "1.7.17",
    drizzleOrmMinimum: "0.45.2",
    mcpPlugin: "@better-auth/mcp@1.7.17",
    cimdPlugin: "@better-auth/cimd@1.7.17",
    mcpServerSdk: "@modelcontextprotocol/server@2.4.0",
    zod: "^4.2.0",
    mcpProtocolProfile: "2026-07-28",
    mcpSdkLegacyMode: "reject",
  },
  rejected: {
    betterAuthLine: "1.8.x beta",
    bespokeTokenIssuer: true,
    parallelOAuthProviderPlugin: true,
    implicitDynamicClientRegistration: true,
  },
  routeSketch: {
    oauthPrefix: "/oauth2",
    mcpResourcePath: "/mcp",
    issuerBase: "dashboard Better Auth baseURL",
    resourceOrigin: "API origin (FLOWMARK_API_URL)",
  },
  deferredVerification: "Agent TASK-008 external MCP clients",
} as const
