import { ApiLive } from "@flowmark/api"
import { Effect, Option } from "effect"
import { createFlowmarkMcpPostHandler } from "../http/post-handler.js"
import { serveMcpProtectedResourceMetadata } from "../http/protected-resource-metadata.js"
import { AGENT_ACCESS_EXECUTION_BOUNDS } from "@flowmark/auth/agent-access"
import { consumeAdmission } from "../runtime/admission.js"
import { McpAuthGateway } from "../ports/mcp-auth-gateway.js"
import { resolveAgentAccessRuntime } from "../runtime/agent-access-runtime.js"
import { McpHostConfiguration } from "../ports/mcp-host-configuration.js"

export type McpRouteRequirements = McpAuthGateway | McpHostConfiguration

export type RunMcpEffect = <A, E>(
  effect: Effect.Effect<A, E, McpRouteRequirements>,
) => Promise<A>

let cachedPost: ((request: Request) => Promise<Response>) | undefined

export const resetMcpRouteCacheForTests = () => {
  cachedPost = undefined
}

const discoveryUnavailable = () =>
  Response.json(
    { message: "Agent access discovery is unavailable." },
    { status: 503, headers: { "cache-control": "no-store" } },
  )

const configurationUnavailable = () =>
  Response.json(
    { message: "MCP is not configured for this deployment." },
    { status: 503, headers: { "cache-control": "no-store" } },
  )

const methodNotAllowed = () =>
  Response.json(
    { message: "Only POST is supported for MCP over HTTP." },
    { status: 405, headers: { allow: "POST", "cache-control": "no-store" } },
  )

const resolvePostHandler = Effect.fn("McpRoutes.resolvePostHandler")(
  function* () {
    const runtime = yield* resolveAgentAccessRuntime()
    const gateway = yield* McpAuthGateway
    const authorizationServerMetadata =
      yield* gateway.readAuthorizationServerMetadata(runtime.issuerOrigin)
    return createFlowmarkMcpPostHandler({
      runtime,
      authorizationServerMetadata,
    })
  },
)

export const createMcpHttpRoutes = (run: RunMcpEffect) => {
  const handleMcpPost = async (request: Request) => {
    if (!cachedPost) {
      const resolved = await run(
        resolvePostHandler().pipe(
          Effect.map((handler) => ({ handler, unavailable: "none" as const })),
          Effect.catchTags({
            AgentAccessRuntimeError: () =>
              Effect.succeed({
                handler: undefined,
                unavailable: "configuration" as const,
              }),
            McpDiscoveryError: () =>
              Effect.succeed({
                handler: undefined,
                unavailable: "discovery" as const,
              }),
          }),
        ),
      )
      if (resolved.unavailable === "configuration") {
        return configurationUnavailable()
      }
      if (resolved.unavailable === "discovery" || !resolved.handler) {
        return discoveryUnavailable()
      }
      cachedPost = resolved.handler
    }
    if (request.method !== "POST") {
      return methodNotAllowed()
    }
    return cachedPost(request)
  }

  const handleMcpProtectedResourceMetadata = async (request: Request) => {
    const runtime = await run(
      resolveAgentAccessRuntime().pipe(
        Effect.map(Option.some),
        Effect.catchTag("AgentAccessRuntimeError", () =>
          Effect.succeed(Option.none()),
        ),
      ),
    )
    if (Option.isNone(runtime)) {
      return configurationUnavailable()
    }
    const resolved = runtime.value
    const admitted = await Effect.runPromise(
      consumeAdmission(
        "service:discovery",
        AGENT_ACCESS_EXECUTION_BOUNDS.discoveryPerServicePerMinute,
      ).pipe(
        Effect.provide(ApiLive),
        Effect.as(true),
        Effect.catchCause(() => Effect.succeed(false)),
      ),
      { signal: request.signal },
    )
    if (!admitted) {
      return Response.json(
        { message: "Discovery admission is unavailable or exhausted." },
        {
          status: 503,
          headers: { "cache-control": "no-store", "retry-after": "60" },
        },
      )
    }
    const gateway = await run(
      Effect.gen(function* () {
        const auth = yield* McpAuthGateway
        const metadata = yield* auth.readAuthorizationServerMetadata(
          resolved.issuerOrigin,
        )
        return Option.some({ metadata })
      }).pipe(
        Effect.catchTag("McpDiscoveryError", () =>
          Effect.succeed(Option.none()),
        ),
      ),
    )
    return Option.match(gateway, {
      onNone: () => discoveryUnavailable(),
      onSome: (discovered) =>
        serveMcpProtectedResourceMetadata(
          request,
          resolved,
          discovered.metadata,
        ) ??
        Response.json(
          { message: "Protected resource metadata is not available here." },
          { status: 404, headers: { "cache-control": "no-store" } },
        ),
    })
  }

  return {
    handleMcpPost,
    handleMcpProtectedResourceMetadata,
  }
}
