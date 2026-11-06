import { fetchClientMetadataResource } from "@better-auth/cimd/node"
import { cimd } from "@better-auth/cimd"
import { mcp } from "@better-auth/mcp"
import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from "@better-auth/oauth-provider"
import { jwt } from "better-auth/plugins"
import { Effect } from "effect"
import {
  jwks,
  oauthAccessToken,
  oauthClient,
  oauthClientAssertion,
  oauthClientResource,
  oauthConsent,
  oauthRefreshToken,
  oauthResource,
} from "@flowmark/db/schema"
import {
  AGENT_ACCESS_ACCESS_TOKEN_TTL_SECONDS,
  AGENT_ACCESS_DASHBOARD_BROWSER_PATHS,
  AGENT_ACCESS_OAUTH_SCOPE_OFFLINE,
  AGENT_ACCESS_OAUTH_SCOPE_READ,
  AGENT_ACCESS_REFRESH_FAMILY_MAX_DAYS,
} from "./protocol-constants.js"
import { resolveAgentAccessOrigins } from "./protocol-contract.js"
import { AgentAccessContractError } from "./contract-errors.js"

type MetadataAuth = {
  readonly api: object
}

const refreshTokenExpiresIn =
  AGENT_ACCESS_REFRESH_FAMILY_MAX_DAYS * 24 * 60 * 60

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"])

export const FLOWMARK_AGENT_ACCESS_PROVIDER = {
  enabledByDefault: false,
  composedWith: ["jwt()", "mcp()", "cimd()"],
  pluginIdsWhenEnabled: ["jwt", "oauth-provider", "cimd"],
  dynamicClientRegistration: false,
  clientMetadataDocuments: "closed",
  tokenAloneGrantsProject: false,
  schemaModels: [
    "jwks",
    "oauthClient",
    "oauthResource",
    "oauthClientResource",
    "oauthRefreshToken",
    "oauthAccessToken",
    "oauthConsent",
    "oauthClientAssertion",
  ],
} as const

export const flowmarkAgentAccessSchema = {
  jwks,
  oauthClient,
  oauthResource,
  oauthClientResource,
  oauthRefreshToken,
  oauthAccessToken,
  oauthConsent,
  oauthClientAssertion,
} as const

export const resolveEnabledAgentAccess = Effect.fn(
  "AgentAccess.resolveEnabled",
)(function* (input: {
  readonly issuerOrigin: string
  readonly apiOrigin: string
}) {
  const origins = yield* resolveAgentAccessOrigins({
    dashboardOrigin: input.issuerOrigin,
    apiOrigin: input.apiOrigin,
  })
  const resource = new URL(origins.mcpResourceUrl)
  if (resource.protocol !== "https:" && !loopbackHosts.has(resource.hostname)) {
    return yield* new AgentAccessContractError({
      reason:
        "MCP resource HTTP is allowed only on loopback. Hosted and self-host resources require HTTPS.",
    })
  }
  return origins
})

const scopes = [
  "openid",
  "profile",
  "email",
  AGENT_ACCESS_OAUTH_SCOPE_OFFLINE,
  AGENT_ACCESS_OAUTH_SCOPE_READ,
] as const

export const flowmarkAgentAccessPlugins = (input: {
  readonly issuerOrigin: string
  readonly mcpResourceUrl: string
}): readonly object[] => [
  jwt({
    jwt: {
      issuer: input.issuerOrigin,
      expirationTime: AGENT_ACCESS_ACCESS_TOKEN_TTL_SECONDS,
    },
  }),
  mcp({
    loginPage: AGENT_ACCESS_DASHBOARD_BROWSER_PATHS.oauthLoginPage,
    consentPage: AGENT_ACCESS_DASHBOARD_BROWSER_PATHS.oauthConsentPage,
    resource: input.mcpResourceUrl,
    scopes: [...scopes],
    accessTokenExpiresIn: AGENT_ACCESS_ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenExpiresIn,
    grantTypes: ["authorization_code", "refresh_token"],
    allowDynamicClientRegistration: false,
    allowUnauthenticatedClientRegistration: false,
    resources: [
      {
        identifier: input.mcpResourceUrl,
        name: "Flowmark",
        accessTokenTtl: AGENT_ACCESS_ACCESS_TOKEN_TTL_SECONDS,
        refreshTokenTtl: refreshTokenExpiresIn,
        allowedScopes: [AGENT_ACCESS_OAUTH_SCOPE_READ],
      },
    ],
  }),
  cimd({
    fetchClientMetadataResource,
    metadataProfile: "mcp-2026-07-28",
    isMetadataDocumentUrlAllowed: () => false,
  }),
]

const hasOAuthMetadata = (
  auth: MetadataAuth,
): auth is MetadataAuth & {
  api: {
    getOAuthServerConfig: (...args: never[]) => unknown
    getOpenIdConfig: (...args: never[]) => unknown
  }
} => "getOAuthServerConfig" in auth.api && "getOpenIdConfig" in auth.api

const canonicalDiscoveryDocument = async (response: Response) => {
  const document = (await response.json()) as Record<string, unknown>
  const issuer = document.issuer
  if (typeof issuer !== "string") {
    return Response.json(document, { status: response.status })
  }
  const mountedPrefix = `${issuer}/api/auth`
  const canonical = Object.fromEntries(
    Object.entries(document).map(([key, value]) => [
      key,
      typeof value === "string" && value.startsWith(mountedPrefix)
        ? `${issuer}${value.slice(mountedPrefix.length)}`
        : value,
    ]),
  )
  return Response.json(canonical, {
    status: response.status,
    headers: { "cache-control": "no-store" },
  })
}

const discoveryDocument = (
  auth: MetadataAuth,
  handler: (
    auth: MetadataAuth & {
      api: {
        getOAuthServerConfig: (...args: never[]) => unknown
        getOpenIdConfig: (...args: never[]) => unknown
      }
    },
  ) => (request: Request) => Promise<Response>,
) =>
  hasOAuthMetadata(auth)
    ? async (request: Request) =>
        canonicalDiscoveryDocument(await handler(auth)(request))
    : async () => new Response(null, { status: 404 })

export const flowmarkAuthorizationServerMetadata = (auth: MetadataAuth) =>
  discoveryDocument(auth, oauthProviderAuthServerMetadata)

export const flowmarkOpenIdConfiguration = (auth: MetadataAuth) =>
  discoveryDocument(auth, oauthProviderOpenIdConfigMetadata)
