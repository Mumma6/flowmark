import { and, desc, eq, isNull } from "drizzle-orm"
import { Effect } from "effect"
import { dataExportRequests } from "../../../schema/data-exports.js"
import { authorize, operationView, query, transaction } from "../access.js"
export const getLatestExport = Effect.fn("DataExports.latest")(function* (
  userId: string,
  sessionId: string,
  projectId: string | null,
) {
  return yield* transaction((tx) =>
    Effect.gen(function* () {
      yield* authorize(tx, userId, sessionId, projectId)
      const [row] = yield* query(() =>
        tx
          .select()
          .from(dataExportRequests)
          .where(
            and(
              eq(dataExportRequests.userId, userId),
              eq(dataExportRequests.sessionId, sessionId),
              projectId === null
                ? isNull(dataExportRequests.projectId)
                : eq(dataExportRequests.projectId, projectId),
            ),
          )
          .orderBy(
            desc(dataExportRequests.createdAt),
            desc(dataExportRequests.id),
          )
          .limit(1),
      )
      return row &&
        row.expiresAt.getTime() > Date.now() &&
        row.state !== "cancelled"
        ? operationView(row)
        : null
    }),
  )
})
