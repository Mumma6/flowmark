import { and, eq } from "drizzle-orm"
import { Effect } from "effect"
import { oauthClient } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export const getAgentConsentClient = Effect.fn("getAgentConsentClient")(
  function* (clientId: string) {
    const db = yield* Database
    const [client] = yield* runQuery(
      DatabaseOperation.GetAgentConsentClient,
      () =>
        db
          .select({
            clientId: oauthClient.clientId,
            name: oauthClient.name,
            redirectUris: oauthClient.redirectUris,
          })
          .from(oauthClient)
          .where(
            and(
              eq(oauthClient.clientId, clientId),
              eq(oauthClient.disabled, false),
            ),
          )
          .limit(1),
    )
    return client
  },
)
