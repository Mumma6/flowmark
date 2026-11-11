import { AgentAccessRuntimeError, McpHostConfiguration } from "@flowmark/mcp"
import { Effect, Layer } from "effect"
import { serverOrigins } from "../../server-env"

/** Origin configuration is independent of the auth provider it configures. */
export const McpHostConfigurationLive = Layer.succeed(
  McpHostConfiguration,
  McpHostConfiguration.of({
    readAuthIssuerOrigin: serverOrigins().pipe(
      Effect.map(({ baseURL }) => baseURL),
      Effect.mapError(
        (error) => new AgentAccessRuntimeError({ reason: error.reason }),
      ),
    ),
  }),
)
