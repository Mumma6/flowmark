import { readAgentAccessGrantFamily } from "@flowmark/auth/agent-access"
import { ApiSettings, DatabaseLive } from "@flowmark/api"
import { Database } from "@flowmark/db/persistence"
import { Effect, Layer } from "effect"
import type { FlowmarkMcpAuthInfo } from "../../auth/claims.js"
import { McpConnectionResolveError } from "../../errors.js"

export type McpGrantFamily = {
  readonly familyId: string
}

// The existing API layer owns acquisition, preview guards and scoped release.
const database = DatabaseLive.pipe(Layer.provide(ApiSettings.layer))

export const resolveMcpGrantFamily = Effect.fn("McpGrantFamily.resolve")(
  function* (identity: FlowmarkMcpAuthInfo) {
    const db = yield* Database
    const family = yield* readAgentAccessGrantFamily(db, {
      subjectUserId: identity.subjectUserId,
      clientId: identity.clientId,
      authorizationCodeId: identity.authorizationCodeId,
      issuer: identity.issuer,
      resource: identity.resourceUrl,
    })
    return { familyId: family.familyId } satisfies McpGrantFamily
  },
  Effect.provide(database),
  Effect.mapError(
    (cause) =>
      new McpConnectionResolveError({
        reason: "The token's active grant family could not be resolved.",
        cause,
      }),
  ),
)
