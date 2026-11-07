import { flowmarkAuthorizationServerMetadata } from "@flowmark/auth/agent-access"
import { Effect, Option, Schema } from "effect"
import type { AuthorizationServerMetadata } from "@modelcontextprotocol/server"
import {
  agentAccessDisabledResponse,
  resolveAgentAccessRuntime,
} from "../../agent-access-runtime"
import { getAuth } from "../../auth"
import {
  createFlowmarkMcpPostHandler,
  serveMcpProtectedResourceMetadata,
} from "./http-handler"

let cachedPost: ((request: Request) => Promise<Response>) | undefined

export const resetMcpRouteCacheForTests = () => {
  cachedPost = undefined
}

const DiscoveryDocument = Schema.Record(Schema.String, Schema.Unknown)

const readAuthorizationServerMetadata = Effect.fn(
  "McpRoute.readAuthorizationServerMetadata",
)(function* (issuerOrigin: string) {
  const auth = yield* getAuth()
  const discovery = yield* Effect.promise(() =>
    flowmarkAuthorizationServerMetadata(auth)(
      new Request(`${issuerOrigin}/.well-known/oauth-authorization-server`),
    ),
  )
  if (discovery.status !== 200) {
    return yield* Effect.fail(
      new Error("Authorization server metadata is unavailable."),
    )
  }
  const body: unknown = yield* Effect.tryPromise({
    try: () => discovery.json(),
    catch: () => new Error("Authorization server metadata is invalid."),
  })
  return yield* Schema.decodeUnknownEffect(DiscoveryDocument)(body).pipe(
    Effect.map((document) => document as AuthorizationServerMetadata),
  )
})

const postHandler = Effect.fn("McpRoute.postHandler")(function* () {
  const runtime = yield* resolveAgentAccessRuntime()
  if (Option.isNone(runtime)) {
    return () => Promise.resolve(agentAccessDisabledResponse())
  }
  const authorizationServerMetadata = yield* readAuthorizationServerMetadata(
    runtime.value.issuerOrigin,
  )
  return createFlowmarkMcpPostHandler({
    runtime: runtime.value,
    authorizationServerMetadata,
  })
})

export const handleMcpPost = async (request: Request) => {
  if (!cachedPost) {
    try {
      cachedPost = await Effect.runPromise(postHandler())
    } catch {
      cachedPost = () =>
        Promise.resolve(
          Response.json(
            { message: "Agent access discovery is unavailable." },
            { status: 503, headers: { "cache-control": "no-store" } },
          ),
        )
    }
  }
  if (request.method !== "POST") {
    return Response.json(
      { message: "Only POST is supported for MCP over HTTP." },
      { status: 405, headers: { allow: "POST", "cache-control": "no-store" } },
    )
  }
  return cachedPost(request)
}

export const handleMcpProtectedResourceMetadata = async (request: Request) => {
  const runtime = await Effect.runPromise(
    resolveAgentAccessRuntime().pipe(
      Effect.catchTag("AgentAccessRuntimeError", () =>
        Effect.succeed(Option.none()),
      ),
    ),
  )
  if (Option.isNone(runtime)) {
    return agentAccessDisabledResponse()
  }
  const auth = await Effect.runPromise(getAuth())
  const discovery = await flowmarkAuthorizationServerMetadata(auth)(
    new Request(
      `${runtime.value.issuerOrigin}/.well-known/oauth-authorization-server`,
    ),
  )
  if (discovery.status !== 200) {
    return Response.json(
      { message: "Agent access discovery is unavailable." },
      { status: 503, headers: { "cache-control": "no-store" } },
    )
  }
  const authorizationServerMetadata = await Effect.runPromise(
    readAuthorizationServerMetadata(runtime.value.issuerOrigin),
  )
  return (
    serveMcpProtectedResourceMetadata(
      request,
      runtime.value,
      authorizationServerMetadata,
    ) ??
    Response.json(
      { message: "Protected resource metadata is not available here." },
      { status: 404, headers: { "cache-control": "no-store" } },
    )
  )
}
