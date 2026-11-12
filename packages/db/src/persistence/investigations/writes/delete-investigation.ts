import { and, eq } from "drizzle-orm"
import { Effect } from "effect"
import { savedInvestigations } from "../../../schema/index.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { investigationScope } from "../sql/investigation-records.js"
import { withInvestigationAccess } from "../with-investigation-access.js"
export const deleteInvestigation = Effect.fn("deleteInvestigation")(function* (
  userId: string,
  projectId: string,
  id: string,
) {
  return yield* withInvestigationAccess(
    userId,
    projectId,
    DatabaseOperation.DeleteSavedInvestigation,
    (tx) =>
      runQuery(DatabaseOperation.DeleteSavedInvestigation, () =>
        tx
          .delete(savedInvestigations)
          .where(
            and(
              investigationScope(userId, projectId),
              eq(savedInvestigations.id, id),
            ),
          )
          .returning({ id: savedInvestigations.id }),
      ).pipe(Effect.map((rows) => ({ deleted: rows.length === 1 }))),
  )
})
