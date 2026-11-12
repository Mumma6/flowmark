import { and, eq } from "drizzle-orm"
import { Effect } from "effect"
import { accountLifecycleOperations } from "../../../schema/account-lifecycle.js"
import { Database } from "../../database.js"
import { lifecycleQuery } from "../../data-lifecycle/access.js"
import { AccountLifecycleRejected } from "../types.js"

export const cancelAccountErasure = Effect.fn("cancelAccountErasure")(
  function* (userId: string, operationId: string) {
    const db = yield* Database
    const [cancelled] = yield* lifecycleQuery(() =>
      db
        .update(accountLifecycleOperations)
        .set({
          state: "cancelled",
          counts: {
            projects: 0,
            runs: 0,
            events: 0,
            apiKeys: 0,
            browserKeys: 0,
            oauthClients: 0,
            delegatedGrants: 0,
            sharedProjects: 0,
            unfinishedProjects: 0,
            previewProjects: [],
            revision: "",
          },
        })
        .where(
          and(
            eq(accountLifecycleOperations.userId, userId),
            eq(accountLifecycleOperations.id, operationId),
            eq(accountLifecycleOperations.state, "previewed"),
          ),
        )
        .returning(),
    )
    if (!cancelled) {
      return yield* new AccountLifecycleRejected({ reason: "Unavailable" })
    }
    return cancelled
  },
)
