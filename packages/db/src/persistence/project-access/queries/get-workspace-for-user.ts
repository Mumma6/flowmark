import { eq } from "drizzle-orm"
import { Effect } from "effect"
import { personalWorkspaces } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export const getWorkspaceForUser = Effect.fn("getWorkspaceForUser")(function* (
  userId: string,
) {
  const db = yield* Database
  const [home] = yield* runQuery(DatabaseOperation.GetWorkspaceForUser, () =>
    db
      .select({ id: personalWorkspaces.workspaceId })
      .from(personalWorkspaces)
      .where(eq(personalWorkspaces.userId, userId)),
  )
  return home?.id
})
