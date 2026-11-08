import { Effect, Option, Result, Schema } from "effect"
import "server-only"
import { remoteAgentAccessFromProbe } from "../connect/agent-access-capability"
import { DashboardApi } from "./api-server-client"

const ResourceMetadata = Schema.Struct({
  resource: Schema.String,
})

export const readRemoteAgentAccess = Effect.fn("readRemoteAgentAccess")(
  function* (apiOrigin: string) {
    const api = yield* DashboardApi
    const response = yield* api
      .request(
        "/.well-known/oauth-protected-resource/mcp",
        { method: "GET", headers: { accept: "application/json" } },
        5000,
      )
      .pipe(
        Effect.map(Option.some),
        Effect.catch(() => Effect.succeed(Option.none<Response>())),
      )
    if (Option.isNone(response)) {
      return remoteAgentAccessFromProbe({
        apiOrigin,
        status: null,
        resource: null,
      })
    }
    const resource =
      response.value.status === 200
        ? yield* Effect.tryPromise({
            try: () => response.value.json() as Promise<unknown>,
            catch: () => new Error("unreadable"),
          }).pipe(
            Effect.map((body) =>
              Schema.decodeUnknownResult(ResourceMetadata)(body).pipe(
                Result.match({
                  onSuccess: (value) => value.resource,
                  onFailure: () => null,
                }),
              ),
            ),
            Effect.orElseSucceed(() => null),
          )
        : null
    return remoteAgentAccessFromProbe({
      apiOrigin,
      status: response.value.status,
      resource,
    })
  },
)
