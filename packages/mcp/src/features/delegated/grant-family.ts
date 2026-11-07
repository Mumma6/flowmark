import { readAgentAccessGrantFamily } from "@flowmark/auth/agent-access"
import { createDatabase } from "@flowmark/db"
import { Effect } from "effect"
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
    const configuredUrl = process.env.DATABASE_URL
    if (!configuredUrl) {
      return yield* new McpConfigurationError({
        reason: "Workflow data is not configured.",
      })
    }
    const { db } = createDatabase(configuredUrl)
    return yield* readAgentAccessGrantFamily(db, {
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
      Effect.map(
        (family) => ({ familyId: family.familyId }) satisfies McpGrantFamily,
      ),
    )
  },
)
