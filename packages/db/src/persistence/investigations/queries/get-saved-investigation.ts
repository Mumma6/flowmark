import { and, eq } from "drizzle-orm"
import { Array, Effect } from "effect"
import { savedInvestigations } from "../../../schema/index.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import {
  investigationColumns,
  investigationScope,
} from "../sql/investigation-records.js"
import { withInvestigationAccess } from "../with-investigation-access.js"
export const getSavedInvestigation = Effect.fn("getSavedInvestigation")(
  function* (userId: string, projectId: string, id: string) {
    return yield* withInvestigationAccess(
      userId,
      projectId,
      DatabaseOperation.ReadSavedInvestigation,
      (tx) =>
        runQuery(DatabaseOperation.ReadSavedInvestigation, () =>
          tx
            .select(investigationColumns)
            .from(savedInvestigations)
            .where(
              and(
                investigationScope(userId, projectId),
                eq(savedInvestigations.id, id),
              ),
            )
            .limit(1),
        ).pipe(Effect.map(Array.head)),
    )
  },
)
