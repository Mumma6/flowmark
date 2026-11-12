import { count } from "drizzle-orm"
import { Array, Effect, Option } from "effect"
import type { SaveInvestigation } from "@flowmarkdev/core"
import { savedInvestigations } from "../../../schema/index.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import {
  investigationColumns,
  investigationScope,
} from "../sql/investigation-records.js"
import { InvestigationRejected } from "../investigation-error.js"
import { withInvestigationAccess } from "../with-investigation-access.js"
export const saveInvestigation = Effect.fn("saveInvestigation")(function* (
  userId: string,
  projectId: string,
  input: SaveInvestigation,
) {
  return yield* withInvestigationAccess(
    userId,
    projectId,
    DatabaseOperation.SaveInvestigation,
    (tx) =>
      Effect.gen(function* () {
        const counts = yield* runQuery(
          DatabaseOperation.SaveInvestigation,
          () =>
            tx
              .select({ total: count() })
              .from(savedInvestigations)
              .where(investigationScope(userId, projectId)),
        )
        if (Option.getOrThrow(Array.head(counts)).total >= 100) {
          return yield* new InvestigationRejected({ reason: "Limit" })
        }
        const rows = yield* runQuery(DatabaseOperation.SaveInvestigation, () =>
          tx
            .insert(savedInvestigations)
            .values({
              ownerId: userId,
              projectId,
              title: input.title.trim(),
              selection: input.selection,
            })
            .returning(investigationColumns),
        )
        return Option.getOrThrow(Array.head(rows))
      }),
    true,
  )
})
