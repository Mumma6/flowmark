import { Effect } from "effect"
import { load, transaction } from "../access.js"
export const checkExport = Effect.fn("DataExports.check")(function* (
  userId: string,
  sessionId: string,
  id: string,
) {
  yield* transaction((tx) => load(tx, userId, sessionId, id))
})
