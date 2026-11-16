import {
  AGENT_ACCESS_OAUTH_SCOPE_READ,
  AGENT_ACCESS_REFERENCE_DEPLOYMENTS,
  buildRequireMcpAuthOverrides,
  resolveAgentAccessOrigins,
} from "@flowmark/auth/agent-access"
import { Array, Effect, Option, Schema } from "effect"
import { AgentAccessRuntimeError } from "../errors.js"
import { McpHostConfiguration } from "../ports/mcp-host-configuration.js"

const HttpOrigin = Schema.URLFromString.check(
  Schema.makeFilter(
    (url) =>
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/",
  ),
)

const hostedEnvironment = (env: NodeJS.ProcessEnv) =>
  env.NODE_ENV === "production" ||
  env.VERCEL_ENV === "production" ||
  env.VERCEL_ENV === "preview"

const referenceApiOrigin = (issuerOrigin: string) =>
  Array.findFirst(
    [
      AGENT_ACCESS_REFERENCE_DEPLOYMENTS.production,
      AGENT_ACCESS_REFERENCE_DEPLOYMENTS.staging,
    ],
    (deployment) => deployment.issuerOrigin === issuerOrigin,
  )

const decodeApiOrigin = (value: string) =>
  Schema.decodeUnknownEffect(HttpOrigin)(value).pipe(
    Effect.mapError(
      () =>
        new AgentAccessRuntimeError({
          reason:
            "FLOWMARK_API_URL must be an HTTP(S) origin without credentials, path, query, or fragment.",
        }),
    ),
    Effect.map((origin) => origin.origin),
  )

const readApiOrigin = Effect.fn("McpRuntime.readApiOrigin")(function* (
  issuerOrigin: string,
  env: NodeJS.ProcessEnv,
) {
  const explicit = env.FLOWMARK_API_URL?.trim()
  if (explicit) {
    return yield* decodeApiOrigin(explicit)
  }
  const known = referenceApiOrigin(issuerOrigin)
  if (Option.isSome(known)) {
    return known.value.apiOrigin
  }
  if (!hostedEnvironment(env)) {
    return "http://localhost:3003"
  }
  return yield* new AgentAccessRuntimeError({
    reason:
      "FLOWMARK_API_URL is required when the issuer is not a reference Flowmark deployment.",
  })
})

export interface ResolvedAgentAccessRuntime {
  readonly issuerOrigin: string
  readonly apiOrigin: string
  readonly mcpResourceUrl: string
  readonly mcpAuth: ReturnType<typeof buildRequireMcpAuthOverrides>
  readonly agentAccessInput: {
    readonly issuerOrigin: string
    readonly apiOrigin: string
  }
}

export const resolveAgentAccessRuntime = Effect.fn(
  "McpRuntime.resolveAgentAccessRuntime",
)(function* (env: NodeJS.ProcessEnv = process.env) {
  const host = yield* McpHostConfiguration
  const authIssuerOrigin = yield* host.readAuthIssuerOrigin
  const apiOrigin = yield* readApiOrigin(authIssuerOrigin, env)
  const origins = yield* resolveAgentAccessOrigins({
    dashboardOrigin: authIssuerOrigin,
    apiOrigin,
  }).pipe(
    Effect.mapError(
      (error) => new AgentAccessRuntimeError({ reason: error.reason }),
    ),
  )
  if (origins.issuerOrigin !== authIssuerOrigin) {
    return yield* new AgentAccessRuntimeError({
      reason: "BETTER_AUTH_URL must be the agent-access issuer origin.",
    })
  }
  return {
    issuerOrigin: origins.issuerOrigin,
    apiOrigin: origins.apiOrigin,
    mcpResourceUrl: origins.mcpResourceUrl,
    mcpAuth: buildRequireMcpAuthOverrides(origins),
    agentAccessInput: {
      issuerOrigin: origins.issuerOrigin,
      apiOrigin: origins.apiOrigin,
    },
  } satisfies ResolvedAgentAccessRuntime
})

export const agentAccessRequiredScopes = () =>
  [AGENT_ACCESS_OAUTH_SCOPE_READ] as const
