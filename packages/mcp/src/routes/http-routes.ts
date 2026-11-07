import { Effect, Option } from "effect"
import { createFlowmarkMcpPostHandler } from "../http/post-handler.js"
import { serveMcpProtectedResourceMetadata } from "../http/protected-resource-metadata.js"
import { McpAuthGateway } from "../ports/mcp-auth-gateway.js"
import {
  agentAccessDisabledResponse,
  resolveAgentAccessRuntime,
  type ResolvedAgentAccessRuntime,
} from "../runtime/agent-access-runtime.js"
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

const methodNotAllowed = () =>
  Response.json(
    { message: "Only POST is supported for MCP over HTTP." },
    { status: 405, headers: { allow: "POST", "cache-control": "no-store" } },
  )

const resolvePostHandler = Effect.fn("McpRoutes.resolvePostHandler")(
  function* () {
    const runtime = yield* resolveAgentAccessRuntime()
    if (Option.isNone(runtime)) {
      return () => Promise.resolve(agentAccessDisabledResponse())
    }
    const gateway = yield* McpAuthGateway
    const authorizationServerMetadata =
      yield* gateway.readAuthorizationServerMetadata(runtime.value.issuerOrigin)
    return createFlowmarkMcpPostHandler({
      runtime: runtime.value,
      authorizationServerMetadata,
    })
  },
)

export const createMcpHttpRoutes = (run: RunMcpEffect) => {
  const handleMcpPost = async (request: Request) => {
    if (!cachedPost) {
      try {
        cachedPost = await run(resolvePostHandler())
      } catch {
        cachedPost = () => Promise.resolve(discoveryUnavailable())
      }
    }
    if (request.method !== "POST") {
      return methodNotAllowed()
    }
    return cachedPost(request)
  }

  const readRuntime = () =>
    resolveAgentAccessRuntime().pipe(
      Effect.catchTag("AgentAccessRuntimeError", () =>
        Effect.succeed(Option.none<ResolvedAgentAccessRuntime>()),
      ),
    )

  const handleMcpProtectedResourceMetadata = async (request: Request) => {
    const runtime = await run(readRuntime())
    if (Option.isNone(runtime)) {
      return agentAccessDisabledResponse()
    }
    const gateway = await run(
      Effect.gen(function* () {
        const auth = yield* McpAuthGateway
        const metadata = yield* auth.readAuthorizationServerMetadata(
          runtime.value.issuerOrigin,
        )
        return { metadata }
      }),
    ).catch(() => null)
    if (!gateway) {
      return discoveryUnavailable()
    }
    return (
      serveMcpProtectedResourceMetadata(
        request,
        runtime.value,
        gateway.metadata,
      ) ??
      Response.json(
        { message: "Protected resource metadata is not available here." },
        { status: 404, headers: { "cache-control": "no-store" } },
      )
    )
  }

  return {
    handleMcpPost,
    handleMcpProtectedResourceMetadata,
  }
}
