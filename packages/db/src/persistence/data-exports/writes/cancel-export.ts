import { eq } from "drizzle-orm"
import { Effect } from "effect"
import { dataExportRequests } from "../../../schema/data-exports.js"
import { load, query, transaction } from "../access.js"
export const cancelExport = Effect.fn("DataExports.cancel")(function* (
  userId: string,
  sessionId: string,
  id: string,
) {
  return yield* transaction((tx) =>
    Effect.gen(function* () {
      yield* load(tx, userId, sessionId, id)
      yield* query(() =>
        tx
          .update(dataExportRequests)
          .set({ state: "cancelled" })
          .where(eq(dataExportRequests.id, id)),
      )
      return { cancelled: true as const }
    }),
  )
})
