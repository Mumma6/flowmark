import { and, desc, eq, gt, or, sql } from "drizzle-orm"
import { Effect } from "effect"
import { dataLifecycleOperations } from "../../../schema/data-lifecycle.js"
import { Database } from "../../database.js"
import { lifecycleQuery } from "../access.js"

export const getErasureStatus = Effect.fn("getErasureStatus")(function* (
  userId: string,
  projectId: string,
) {
  const db = yield* Database
  const [operation] = yield* lifecycleQuery(() =>
    db
      .select()
      .from(dataLifecycleOperations)
      .where(
        and(
          eq(dataLifecycleOperations.actorId, userId),
          eq(dataLifecycleOperations.projectId, projectId),
          or(
            eq(dataLifecycleOperations.state, "purging"),
            gt(dataLifecycleOperations.expiresAt, new Date()),
          ),
          or(
            eq(dataLifecycleOperations.state, "live_data_deleted"),
            sql`EXISTS (SELECT 1 FROM project_members WHERE project_id = ${projectId}::uuid AND user_id = ${userId} AND role = 'owner')`,
          ),
        ),
      )
      .orderBy(desc(dataLifecycleOperations.createdAt))
      .limit(1),
  )
  return operation ?? null
})
