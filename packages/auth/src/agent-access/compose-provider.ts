import { fetchClientMetadataResource } from "@better-auth/cimd/node"
import { cimd } from "@better-auth/cimd"
import { mcp } from "@better-auth/mcp"
import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from "@better-auth/oauth-provider"
import { jwt } from "better-auth/plugins"
import {
  Array as Arr,
  Data,
  Effect,
  Match,
  Option,
  Record,
  Result,
  Schema,
} from "effect"
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

const loopbackHosts = ["localhost", "127.0.0.1", "[::1]"] as const

class AgentAccessDiscoveryError extends Data.TaggedError(
  "AgentAccessDiscoveryError",
)<{
  readonly cause: unknown
}> {}

export const FLOWMARK_AGENT_ACCESS_PROVIDER = {
  enabledByDefault: false,
  composedWith: ["jwt()", "mcp()", "cimd()"],
  pluginIdsWhenEnabled: ["jwt", "oauth-provider", "cimd"],
  dynamicClientRegistration: false,
  clientMetadataDocuments: "closed",
  tokenAloneGrantsProject: false,
  grantFamilyKey: "authorizationCodeId",
  projectGrantIncluded: false,
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

const readUrl = (value: string, reason: string) =>
  Effect.try({
    try: () => new URL(value),
    catch: () => new AgentAccessContractError({ reason }),
  })

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
  const resource = yield* readUrl(
    origins.mcpResourceUrl,
    "MCP resource URL is not valid.",
  )
  return yield* Match.value(resource.protocol).pipe(
    Match.when("https:", () => Effect.succeed(origins)),
    Match.when("http:", () =>
      Arr.contains(loopbackHosts, resource.hostname)
        ? Effect.succeed(origins)
        : Effect.fail(
            new AgentAccessContractError({
              reason:
                "MCP resource HTTP is allowed only on loopback. Hosted and self-host resources require HTTPS.",
            }),
          ),
    ),
    Match.orElse(() =>
      Effect.fail(
        new AgentAccessContractError({
          reason:
            "MCP resource HTTP is allowed only on loopback. Hosted and self-host resources require HTTPS.",
        }),
      ),
    ),
  )
})

export const alignAgentAccessWithBaseUrl = Effect.fn("AgentAccess.alignIssuer")(
  function* (
    input: {
      readonly issuerOrigin: string
      readonly apiOrigin: string
    },
    baseURL: string,
  ) {
    const origins = yield* resolveEnabledAgentAccess(input)
    const base = yield* readUrl(baseURL, "Auth base URL is not a valid origin.")
    return yield* base.origin === origins.issuerOrigin
      ? Effect.succeed(origins)
      : new AgentAccessContractError({
          reason: "BETTER_AUTH_URL must be the agent-access issuer origin.",
        })
  },
)

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
        allowedScopes: [...scopes],
      },
    ],
  }),
  cimd({
    fetchClientMetadataResource,
    metadataProfile: "mcp-2026-07-28",
    isMetadataDocumentUrlAllowed: () => false,
  }),
]

type OAuthMetadataApi = {
  readonly getOAuthServerConfig: (...args: never[]) => unknown
  readonly getOpenIdConfig: (...args: never[]) => unknown
}

const DiscoveryDocument = Schema.Record(Schema.String, Schema.Unknown)

const oauthMetadataApi = (auth: MetadataAuth) => {
  const api: Partial<OAuthMetadataApi> = auth.api
  return typeof api.getOAuthServerConfig === "function" &&
    typeof api.getOpenIdConfig === "function"
    ? Option.some(api as OAuthMetadataApi)
    : Option.none()
}

const canonicalizeDiscoveryDocument = (document: Record<string, unknown>) =>
  Schema.decodeUnknownResult(Schema.String)(document.issuer).pipe(
    Result.match({
      onFailure: () => document,
      onSuccess: (issuer) => {
        const mountedPrefix = `${issuer}/api/auth`
        return Record.map(document, (value) =>
          typeof value === "string" && value.startsWith(mountedPrefix)
            ? `${issuer}${value.slice(mountedPrefix.length)}`
            : value,
        )
      },
    }),
  )

const canonicalDiscoveryDocument = Effect.fn("AgentAccess.canonicalDiscovery")(
  function* (response: Response) {
    const body = yield* Effect.tryPromise({
      try: () => response.json() as Promise<unknown>,
      catch: (cause) => new AgentAccessDiscoveryError({ cause }),
    })
    const document = yield* Schema.decodeUnknownEffect(DiscoveryDocument)(
      body,
    ).pipe(Effect.mapError((cause) => new AgentAccessDiscoveryError({ cause })))
    return Response.json(canonicalizeDiscoveryDocument(document), {
      status: response.status,
      headers: { "cache-control": "no-store" },
    })
  },
)

const serveDiscovery = (
  effect: Effect.Effect<Response, AgentAccessDiscoveryError>,
) =>
  Effect.runPromise(
    effect.pipe(
      Effect.catchTag("AgentAccessDiscoveryError", () =>
        Effect.succeed(
          Response.json(
            { message: "Agent access discovery is unavailable." },
            { status: 503, headers: { "cache-control": "no-store" } },
          ),
        ),
      ),
    ),
  )

const discoveryDocument = (
  auth: MetadataAuth,
  handler: (
    auth: MetadataAuth & { api: OAuthMetadataApi },
  ) => (request: Request) => Promise<Response>,
) =>
  Option.match(oauthMetadataApi(auth), {
    onNone: () => () =>
      serveDiscovery(Effect.succeed(new Response(null, { status: 404 }))),
    onSome: (api) => (request: Request) =>
      serveDiscovery(
        Effect.tryPromise({
          try: () => handler({ ...auth, api })(request),
          catch: (cause) => new AgentAccessDiscoveryError({ cause }),
        }).pipe(Effect.flatMap(canonicalDiscoveryDocument)),
      ),
  })

export const flowmarkAuthorizationServerMetadata = (auth: MetadataAuth) =>
  discoveryDocument(auth, oauthProviderAuthServerMetadata)

export const flowmarkOpenIdConfiguration = (auth: MetadataAuth) =>
  discoveryDocument(auth, oauthProviderOpenIdConfigMetadata)
