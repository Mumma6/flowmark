import { randomUUID } from "node:crypto"
import { and, eq, lte, sql } from "drizzle-orm"
import { Effect } from "effect"
import { dataExportRequests } from "../../../schema/data-exports.js"
import { authorize, operationView, query, transaction } from "../access.js"
import { DataExportRejected } from "../types.js"
export const createExport = Effect.fn("DataExports.create")(function* (
  userId: string,
  sessionId: string,
  projectId: string | null,
) {
  return yield* transaction((tx) =>
    Effect.gen(function* () {
      // The actor lock serializes admission; never accumulate unbounded metadata.
      yield* query(() =>
        tx.execute(sql`SELECT id FROM "user" WHERE id=${userId} FOR UPDATE`),
      )
      yield* authorize(tx, userId, sessionId, projectId)
      yield* query(() =>
        tx
          .delete(dataExportRequests)
          .where(
            and(
              eq(dataExportRequests.userId, userId),
              lte(dataExportRequests.expiresAt, new Date()),
            ),
          ),
      )
      const existing = yield* query(() =>
        tx
          .select({ id: dataExportRequests.id })
          .from(dataExportRequests)
          .where(eq(dataExportRequests.userId, userId))
          .limit(20),
      )
      if (existing.length >= 20) {
        return yield* new DataExportRejected({ reason: "TooManyRequests" })
      }
      const [row] = yield* query(() =>
        tx
          .insert(dataExportRequests)
          .values({
            userId,
            sessionId,
            projectId,
            token: randomUUID(),
            position: { category: 0, after: "", part: 1 },
            expiresAt: new Date(Date.now() + 900000),
          })
          .returning(),
      )
      return operationView(row)
    }),
  )
})
