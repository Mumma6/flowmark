import { GetMcpAgentConnection } from "@flowmark/api"
import { Effect } from "effect"
import type { FlowmarkMcpAuthInfo } from "../../auth/claims.js"
import { McpConnectionResolveError } from "../../errors.js"
import { resolveMcpGrantFamily } from "../delegated/grant-family.js"

export const resolveMcpConnection = Effect.fn("McpConnection.resolve")(
  function* (identity: FlowmarkMcpAuthInfo) {
    const family = yield* resolveMcpGrantFamily(identity)
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
        Effect.catchTags({
          PersistenceError: () =>
            Effect.fail(
              new McpConnectionResolveError({
                reason: "Connection details could not be read.",
              }),
            ),
        }),
      )
  },
)
