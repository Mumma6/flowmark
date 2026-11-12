import { and, asc, eq, sql } from "drizzle-orm"
import { Array, Effect, Option, Result } from "effect"
import type { SavedInvestigationList } from "@flowmarkdev/core"
import { savedInvestigations } from "../../../schema/index.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import {
  investigationColumns,
  investigationScope,
} from "../sql/investigation-records.js"
import { withInvestigationAccess } from "../with-investigation-access.js"
import { InvestigationRejected } from "../investigation-error.js"
import {
  decodeInvestigationCursor,
  encodeInvestigationCursor,
} from "../investigation-cursor.js"
export const listSavedInvestigations = Effect.fn("listSavedInvestigations")(
  function* (userId: string, projectId: string, input: SavedInvestigationList) {
    const after = yield* Option.match(Option.fromUndefinedOr(input.cursor), {
      onNone: () => Effect.succeed(undefined),
      onSome: (cursor) =>
        Result.match(decodeInvestigationCursor(userId, projectId, cursor), {
          onFailure: () =>
            Effect.fail(new InvestigationRejected({ reason: "InvalidCursor" })),
          onSuccess: (value) => Effect.succeed(value),
        }),
    })
    return yield* withInvestigationAccess(
      userId,
      projectId,
      DatabaseOperation.ReadSavedInvestigation,
      (tx) =>
        Effect.gen(function* () {
          if (after) {
            const anchor = yield* runQuery(
              DatabaseOperation.ReadSavedInvestigation,
              () =>
                tx
                  .select({ id: savedInvestigations.id })
                  .from(savedInvestigations)
                  .where(
                    and(
                      investigationScope(userId, projectId),
                      eq(savedInvestigations.id, after.id),
                      sql`${savedInvestigations.createdAt} = ${after.createdAt}::timestamptz`,
                    ),
                  )
                  .limit(1),
            )
            if (anchor.length === 0) {
              return yield* new InvestigationRejected({
                reason: "InvalidCursor",
              })
            }
          }
          const limit = input.limit ?? 25
          const rows = yield* runQuery(
            DatabaseOperation.ReadSavedInvestigation,
            () =>
              tx
                .select(investigationColumns)
                .from(savedInvestigations)
                .where(
                  and(
                    investigationScope(userId, projectId),
                    after
                      ? sql`(${savedInvestigations.createdAt}, ${savedInvestigations.id}) > (${after.createdAt}::timestamptz, ${after.id}::uuid)`
                      : undefined,
                  ),
                )
                .orderBy(
                  asc(savedInvestigations.createdAt),
                  asc(savedInvestigations.id),
                )
                .limit(limit + 1),
          )
          const items = Array.take(rows, limit)
          return {
            items,
            nextCursor:
              rows.length > limit
                ? Array.last(items).pipe(
                    Option.map((last) =>
                      encodeInvestigationCursor(userId, projectId, last),
                    ),
                    Option.getOrNull,
                  )
                : null,
          }
        }),
    )
  },
)
