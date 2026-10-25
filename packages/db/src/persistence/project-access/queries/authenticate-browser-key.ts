import { eq } from "drizzle-orm"
import { Effect } from "effect"
import { projectBrowserKeys } from "../../../schema/index.js"
import { Database, hashApiKey } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export const authenticateBrowserKey = Effect.fn("authenticateBrowserKey")(
  function* (key: string) {
    const db = yield* Database
    const rows = yield* runQuery(DatabaseOperation.AuthenticateBrowser, () =>
      db
        .select({
          id: projectBrowserKeys.id,
          projectId: projectBrowserKeys.projectId,
          allowedOrigins: projectBrowserKeys.allowedOrigins,
        })
        .from(projectBrowserKeys)
        .where(eq(projectBrowserKeys.keyHash, hashApiKey(key)))
        .limit(1),
    )
    return rows.at(0)
  },
)
