import {
  AGENT_ACCESS_OAUTH_SCOPE_READ,
  buildRequireMcpAuthOverrides,
  resolveAgentAccessOrigins,
} from "@flowmark/auth/agent-access"
import { Data, Effect, Option, Schema } from "effect"
import { serverOrigins } from "./server-env"

export class AgentAccessRuntimeError extends Data.TaggedError(
  "AgentAccessRuntimeError",
)<{
  readonly reason: string
}> {}

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

const readApiOrigin = Effect.fn("readApiOrigin")(function* (
  env: NodeJS.ProcessEnv = process.env,
) {
  const explicit = env.FLOWMARK_API_URL?.trim()
  if (explicit) {
    yield* Schema.decodeUnknownEffect(HttpOrigin)(explicit).pipe(
      Effect.mapError(
        () =>
          new AgentAccessRuntimeError({
            reason:
              "FLOWMARK_API_URL must be an HTTP(S) origin without credentials, path, query, or fragment.",
          }),
      ),
    )
    return new URL(explicit).origin
  }
  if (
    env.NODE_ENV === "production" ||
    env.VERCEL_ENV === "production" ||
    env.VERCEL_ENV === "preview"
  ) {
    return yield* new AgentAccessRuntimeError({
      reason: "FLOWMARK_API_URL is required when agent access is enabled.",
    })
  }
  return "http://127.0.0.1:3003"
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

export const resolveAgentAccessRuntime = Effect.fn("resolveAgentAccessRuntime")(
  function* (env: NodeJS.ProcessEnv = process.env) {
    if (!isAgentAccessEnabled(env)) {
      return Option.none<ResolvedAgentAccessRuntime>()
    }
    const { baseURL } = yield* serverOrigins(env).pipe(
      Effect.mapError(
        (error) => new AgentAccessRuntimeError({ reason: error.reason }),
      ),
    )
    const apiOrigin = yield* readApiOrigin(env)
    const origins = yield* resolveAgentAccessOrigins({
      dashboardOrigin: baseURL,
      apiOrigin,
    }).pipe(
      Effect.mapError(
        (error) => new AgentAccessRuntimeError({ reason: error.reason }),
      ),
    )
    if (origins.issuerOrigin !== baseURL) {
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
  },
)

export const agentAccessDisabledResponse = () =>
  Response.json(
    { message: "Agent access is not enabled on this deployment." },
    { status: 404, headers: { "cache-control": "no-store" } },
  )

export const agentAccessRequiredScopes = () =>
  [AGENT_ACCESS_OAUTH_SCOPE_READ] as const
