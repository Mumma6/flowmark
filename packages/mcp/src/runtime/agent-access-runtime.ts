import {
  AGENT_ACCESS_OAUTH_SCOPE_READ,
  buildRequireMcpAuthOverrides,
  resolveAgentAccessOrigins,
} from "@flowmark/auth/agent-access"
import { Effect, Option, Schema } from "effect"
import { AgentAccessRuntimeError } from "../errors.js"
import { McpHostConfiguration } from "../ports/mcp-host-configuration.js"

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

const hostedEnvironment = (env: NodeJS.ProcessEnv) =>
  env.NODE_ENV === "production" ||
  env.VERCEL_ENV === "production" ||
  env.VERCEL_ENV === "preview"

const readApiOrigin = Effect.fn("McpRuntime.readApiOrigin")(function* (
  env: NodeJS.ProcessEnv = process.env,
) {
  return yield* Option.fromNullishOr(env.FLOWMARK_API_URL?.trim()).pipe(
    Option.filter((value) => value.length > 0),
    Option.match({
      onNone: () =>
        hostedEnvironment(env)
          ? Effect.fail(
              new AgentAccessRuntimeError({
                reason:
                  "FLOWMARK_API_URL is required when agent access is enabled.",
              }),
            )
          : Effect.succeed("http://127.0.0.1:3003"),
      onSome: (explicit) =>
        Schema.decodeUnknownEffect(HttpOrigin)(explicit).pipe(
          Effect.mapError(
            () =>
              new AgentAccessRuntimeError({
                reason:
                  "FLOWMARK_API_URL must be an HTTP(S) origin without credentials, path, query, or fragment.",
              }),
          ),
          Effect.map((origin) => new URL(origin).origin),
        ),
    }),
  )
})

const isAgentAccessEnabled = (env: NodeJS.ProcessEnv = process.env) =>
  env.FLOWMARK_AGENT_ACCESS_ENABLED === "true"

export interface ResolvedAgentAccessRuntime {
  readonly enabled: true
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
  if (!isAgentAccessEnabled(env)) {
    return Option.none<ResolvedAgentAccessRuntime>()
  }
  const host = yield* McpHostConfiguration
  const authIssuerOrigin = yield* host.readAuthIssuerOrigin
  const apiOrigin = yield* readApiOrigin(env)
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
  return Option.some({
    enabled: true,
    issuerOrigin: origins.issuerOrigin,
    apiOrigin: origins.apiOrigin,
    mcpResourceUrl: origins.mcpResourceUrl,
    mcpAuth: buildRequireMcpAuthOverrides(origins),
    agentAccessInput: {
      issuerOrigin: origins.issuerOrigin,
      apiOrigin: origins.apiOrigin,
    },
  } satisfies ResolvedAgentAccessRuntime)
})

export const agentAccessDisabledResponse = () =>
  Response.json(
    { message: "Agent access is not enabled on this deployment." },
    { status: 404, headers: { "cache-control": "no-store" } },
  )

export const agentAccessRequiredScopes = () =>
  [AGENT_ACCESS_OAUTH_SCOPE_READ] as const
