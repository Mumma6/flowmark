import { and, eq, or } from "drizzle-orm"
import { Effect } from "effect"
import { sharedInvestigations } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { runQuery } from "../../run-query.js"
import { DatabaseOperation } from "../../database-operation.js"
import { SharedInvestigationRejected } from "../types.js"
export const revokeSharedInvestigation = Effect.fn("revokeSharedInvestigation")(
  function* (projectId: string, userId: string, owner: boolean, id: string) {
    const db = yield* Database
    const rows = yield* runQuery(DatabaseOperation.SharedInvestigations, () =>
      db
        .delete(sharedInvestigations)
        .where(
          and(
            eq(sharedInvestigations.projectId, projectId),
            eq(sharedInvestigations.id, id),
            owner ? undefined : or(eq(sharedInvestigations.creatorId, userId)),
          ),
        )
        .returning({ id: sharedInvestigations.id }),
    )
    if (rows.length !== 1) {
      return yield* new SharedInvestigationRejected({ reason: "Unauthorized" })
    }
    return { revoked: true as const }
  },
)
