import { sql } from "drizzle-orm"
import { Effect } from "effect"
import type { ShareInvestigation } from "@flowmarkdev/core"
import { sharedInvestigations } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { runQuery } from "../../run-query.js"
import { DatabaseOperation } from "../../database-operation.js"
import { SharedInvestigationRejected } from "../types.js"
export const createSharedInvestigation = Effect.fn("createSharedInvestigation")(
  function* (projectId: string, creatorId: string, input: ShareInvestigation) {
    const db = yield* Database
    const [count] = yield* runQuery(
      DatabaseOperation.SharedInvestigations,
      () =>
        db.execute<{ total: number; owned: number }>(sql`
    SELECT count(*)::int AS total,count(*) FILTER(WHERE creator_id=${creatorId})::int AS owned FROM shared_investigations WHERE project_id=${projectId}::uuid`),
    )
    if (!count || count.total >= 100 || count.owned >= 25) {
      return yield* new SharedInvestigationRejected({ reason: "Limit" })
    }
    const [row] = yield* runQuery(DatabaseOperation.SharedInvestigations, () =>
      db
        .insert(sharedInvestigations)
        .values({
          projectId,
          creatorId,
          title: input.title.trim(),
          selection: input.selection,
        })
        .returning({ id: sharedInvestigations.id }),
    )
    if (!row) {
      return yield* new SharedInvestigationRejected({ reason: "Unavailable" })
    }
    return row.id
  },
)
