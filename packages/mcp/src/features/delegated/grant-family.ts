import { AuthorizeAgentRead } from "@flowmark/api"
import { Effect } from "effect"
import type { FlowmarkMcpAuthInfo } from "../../auth/claims.js"
import { McpConnectionResolveError } from "../../errors.js"

export type McpGrantFamily = { readonly familyId: string }

export const resolveMcpGrantFamily = Effect.fn("McpGrantFamily.resolve")(
  function* (identity: FlowmarkMcpAuthInfo) {
    const access = yield* AuthorizeAgentRead
    return yield* access.grantFamily({
      subjectUserId: identity.subjectUserId,
      clientId: identity.clientId,
      authorizationCodeId: identity.authorizationCodeId,
      resource: identity.resourceUrl,
    })
  },
  Effect.mapError(
    (cause) =>
      new McpConnectionResolveError({
        reason: "The token's active grant family could not be resolved.",
        cause,
      }),
  ),
)
