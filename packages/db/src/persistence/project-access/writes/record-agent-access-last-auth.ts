import { sql } from "drizzle-orm"
import { Effect } from "effect"
import { agentAccessConnectionLastAuth } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export const recordAgentAccessLastAuth = Effect.fn("recordAgentAccessLastAuth")(
  function* (input: {
    readonly userId: string
    readonly clientId: string
    readonly authorizationCodeId: string
    readonly at: Date
  }) {
    const db = yield* Database
    yield* runQuery(DatabaseOperation.RecordAgentAccessLastAuth, () =>
      db
        .insert(agentAccessConnectionLastAuth)
        .values({
          authorizationCodeId: input.authorizationCodeId,
          userId: input.userId,
          clientId: input.clientId,
          lastAuthenticatedAt: input.at,
        })
        .onConflictDoUpdate({
          target: agentAccessConnectionLastAuth.authorizationCodeId,
          set: {
            userId: sql`excluded.user_id`,
            clientId: sql`excluded.client_id`,
            lastAuthenticatedAt: input.at,
            updatedAt: input.at,
          },
        }),
    )
  },
)
