import { flowmarkAuthorizationServerMetadata } from "@flowmark/auth/agent-access"
import {
  McpAuthGateway,
  McpDiscoveryError,
  type AuthorizationServerMetadata,
} from "@flowmark/mcp"
import { Effect, Layer, Schema } from "effect"
import { getAuth } from "../../auth"
import { McpHostConfigurationLive } from "./mcp-host-configuration"

const DiscoveryDocument = Schema.Record(Schema.String, Schema.Unknown)

export const McpAuthGatewayLive = Layer.succeed(
  McpAuthGateway,
  McpAuthGateway.of({
    readAuthorizationServerMetadata: Effect.fn(
      "McpAuthGateway.readAuthorizationServerMetadata",
    )(function* (issuerOrigin: string) {
      const auth = yield* getAuth().pipe(
        Effect.catchTag("ConfigurationError", (error) =>
          Effect.fail(
            new McpDiscoveryError({
              reason:
                error.cause instanceof Error
                  ? error.cause.message
                  : "Authentication is not configured.",
            }),
          ),
        ),
      )
      const discovery = yield* Effect.promise(() =>
        flowmarkAuthorizationServerMetadata(auth)(
          new Request(`${issuerOrigin}/.well-known/oauth-authorization-server`),
        ),
      )
      if (discovery.status !== 200) {
        return yield* new McpDiscoveryError({
          reason: "Authorization server metadata is unavailable.",
        })
      }
      const body: unknown = yield* Effect.tryPromise({
        try: () => discovery.json(),
        catch: () =>
          new McpDiscoveryError({
            reason: "Authorization server metadata is invalid.",
          }),
      })
      return yield* Schema.decodeUnknownEffect(DiscoveryDocument)(body).pipe(
        Effect.mapError(
          () =>
            new McpDiscoveryError({
              reason: "Authorization server metadata is invalid.",
            }),
        ),
        Effect.map((document) => document as AuthorizationServerMetadata),
      )
    }),
  }),
)

export const McpServerLayer = Layer.mergeAll(
  McpHostConfigurationLive,
  McpAuthGatewayLive,
)
