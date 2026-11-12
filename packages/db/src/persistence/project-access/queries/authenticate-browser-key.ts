import { activeProjectOwners } from "../../account-lifecycle/active-account.js"
import { sql, and, eq, isNull } from "drizzle-orm"
import { Effect } from "effect"
import { projectBrowserKeys, projects } from "../../../schema/index.js"
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
        .innerJoin(projects, eq(projects.id, projectBrowserKeys.projectId))
        .where(
          and(
            eq(projectBrowserKeys.keyHash, hashApiKey(key)),
            eq(projectBrowserKeys.credentialEpoch, projects.credentialEpoch),
            isNull(projects.lifecycleOperationId),
            activeProjectOwners(sql`${projects.id}`),
          ),
        )
        .limit(1),
    )
    return rows.at(0)
  },
)
