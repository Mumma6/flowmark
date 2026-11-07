import { readAgentAccessGrantFamily } from "@flowmark/auth/agent-access"
import { createDatabase } from "@flowmark/db"
import { Effect, Option } from "effect"
import type { FlowmarkMcpAuthInfo } from "../../auth/claims.js"
import {
  McpConfigurationError,
  McpConnectionResolveError,
} from "../../errors.js"

export type McpGrantFamily = {
  readonly familyId: string
}

export const resolveMcpGrantFamily = Effect.fn("McpGrantFamily.resolve")(
  function* (identity: FlowmarkMcpAuthInfo) {
    const configuredUrl = yield* Option.fromNullishOr(
      process.env.DATABASE_URL,
    ).pipe(
      Option.filter((url) => url.length > 0),
      Effect.fromOption(
        () =>
          new McpConfigurationError({
            reason: "Workflow data is not configured.",
          }),
      ),
    )
    const { db } = createDatabase(configuredUrl)
    return yield* readAgentAccessGrantFamily(db, {
      subjectUserId: identity.subjectUserId,
      clientId: identity.clientId,
      issuer: identity.issuer,
      resource: identity.resourceUrl,
    }).pipe(
      Effect.catchTags({
        AgentAccessContractError: (error) =>
          Effect.fail(
            new McpConnectionResolveError({
              reason: error.reason,
            }),
          ),
      }),
      Effect.map(
        (family) => ({ familyId: family.familyId }) satisfies McpGrantFamily,
      ),
    )
  },
)
