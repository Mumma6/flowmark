/**
 * Agent TASK-001.1 decision record. Packages listed here are **not installed**
 * until a maintainer approves the tranche in ADR 0007.
 */
export const AGENT_ACCESS_MCP_DEPENDENCY_PROPOSAL = {
  adr: "docs/decisions/0007-connect-agent-mcp-dependencies.md",
  status: "accepted",
  reviewedOn: "2026-11-05",
  evidence: {
    npmPackInspection: [
      "@better-auth/mcp@1.7.17",
      "@better-auth/oauth-provider@1.7.17",
      "@better-auth/cimd@1.7.17",
    ],
    inRepoReview: [
      "packages/auth/src/create-auth.ts",
      "packages/db/src/schema/auth.ts",
      "apps/dashboard/features/platform/api-proxy.ts",
      "apps/server/src/server-env.ts",
    ],
  },
  current: {
    betterAuth: "1.7.13",
    drizzleAdapter: "1.7.13",
    drizzleOrm: "0.44.x",
    authPlugins: ["accountRateLimits"],
    mcpPackagesInstalled: false,
    oauthTablesInDb: false,
  },
  proposed: {
    betterAuth: "1.7.17",
    drizzleAdapter: "1.7.17",
    drizzleOrmMinimum: "0.45.2",
    betterCall: "1.4.5",
    mcpPlugin: "@better-auth/mcp@1.7.17",
    cimdPlugin: "@better-auth/cimd@1.7.17",
    oauthProviderTransitive: "@better-auth/oauth-provider@^1.7.17",
    mcpServerSdk: "@modelcontextprotocol/server@2.3.1",
    mcpServerSdkProbeAlternative: "@modelcontextprotocol/server@2.4.0",
    zod: "^4.2.0",
    requiredBetterAuthPlugins: ["jwt", "mcp", "cimd"],
    mcpProtocolProfile: "2026-07-28",
    cimdMetadataProfile: "mcp-2026-07-28",
    mcpSdkLegacyMode: "reject",
    mcpRefreshTokenReuseIntervalSeconds: 30,
  },
  oauthProviderSchemaModels: [
    "oauthClient",
    "oauthResource",
    "oauthClientResource",
    "oauthAccessToken",
    "oauthConsent",
    "oauthClientAssertion",
  ],
  rejected: {
    betterAuthLine: "1.8.x beta",
    bespokeTokenIssuer: true,
    parallelOAuthProviderPlugin: true,
    implicitDynamicClientRegistration: true,
  },
  integrationConstraints: {
    twoOriginLayout: true,
    requireMcpAuthIssuerOverride: true,
    dashboardProxyExternalAuthRedirects: false,
    mcpResourceOnApiOrigin: true,
  },
  routeSketch: {
    oauthPrefix: "/oauth2",
    protectedResourceMetadataPath: "/.well-known/oauth-protected-resource",
    mcpResourcePath: "/mcp",
    issuerBase: "BETTER_AUTH_URL (dashboard-facing origin)",
    resourceOrigin: "API origin (FLOWMARK_API_URL or server public URL)",
  },
  deferredVerification: "Agent TASK-008 external MCP clients",
} as const
