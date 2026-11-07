import { GetMcpAgentConnection } from "@flowmark/api"
import { readAgentAccessGrantFamily } from "@flowmark/auth/agent-access"
import { createDatabase } from "@flowmark/db"
import { Effect } from "effect"
import type { FlowmarkMcpAuthInfo } from "../../auth/claims.js"
import {
  McpConfigurationError,
  McpConnectionResolveError,
} from "../../errors.js"

export const resolveMcpConnection = Effect.fn("McpConnection.resolve")(
  function* (identity: FlowmarkMcpAuthInfo) {
    const configuredUrl = process.env.DATABASE_URL
    if (!configuredUrl) {
      return yield* new McpConfigurationError({
        reason: "Workflow data is not configured.",
      })
    }
    const { db } = createDatabase(configuredUrl)
    const family = yield* readAgentAccessGrantFamily(db, {
      subjectUserId: identity.subjectUserId,
      clientId: identity.clientId,
      issuer: identity.issuer,
      resource: identity.resourceUrl,
    }).pipe(
      Effect.catchTag("AgentAccessContractError", (error) =>
        Effect.fail(
          new McpConnectionResolveError({
            reason:
              error.reason ??
              "This connection is revoked, expired, or not authorized for this resource.",
          }),
        ),
      ),
    )
    const getMcp = yield* GetMcpAgentConnection
    return yield* getMcp
      .resolve({
        userId: identity.subjectUserId,
        clientId: identity.clientId,
        authorizationCodeId: family.familyId,
        resourceUrl: identity.resourceUrl,
        authenticatedAt: new Date(),
      })
      .pipe(
        Effect.mapError(
          () =>
            new McpConnectionResolveError({
              reason: "Connection details could not be read.",
            }),
        ),
      )
  },
)
