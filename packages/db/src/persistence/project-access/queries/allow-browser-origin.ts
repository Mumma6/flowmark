import { activeProjectOwners } from "../../account-lifecycle/active-account.js"
import { and, eq, isNull, sql } from "drizzle-orm"
import { Effect } from "effect"
import { projectBrowserKeys, projects } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export const browserOriginAllowed = Effect.fn("browserOriginAllowed")(
  function* (origin: string) {
    const db = yield* Database
    const rows = yield* runQuery(DatabaseOperation.BrowserOrigin, () =>
      db
        .select({ id: projectBrowserKeys.id })
        .from(projectBrowserKeys)
        .innerJoin(projects, eq(projects.id, projectBrowserKeys.projectId))
        .where(
          and(
            isNull(projects.lifecycleOperationId),
            activeProjectOwners(sql`${projects.id}`),
            eq(projectBrowserKeys.credentialEpoch, projects.credentialEpoch),
            sql`${projectBrowserKeys.allowedOrigins} @> ${JSON.stringify([origin])}::jsonb`,
          ),
        )
        .limit(1),
    )
    return rows.length > 0
  },
)
