import { and, eq } from "drizzle-orm"
import { Effect } from "effect"
import { dataLifecycleOperations } from "../../../schema/data-lifecycle.js"
import { Database } from "../../database.js"
import { lifecycleQuery } from "../access.js"
import { LifecycleRejected } from "../types.js"

export const cancelErasure = Effect.fn("cancelErasure")(function* (
  userId: string,
  projectId: string,
  operationId: string,
) {
  const db = yield* Database
  const [cancelled] = yield* lifecycleQuery(() =>
    db
      .update(dataLifecycleOperations)
      .set({
        state: "cancelled",
        projectName: "",
        scope: { kind: "project" },
        counts: {
          runs: 0,
          events: 0,
          apiKeys: 0,
          browserKeys: 0,
          configurations: 0,
          latestStart: null,
          revision: "",
        },
      })
      .where(
        and(
          eq(dataLifecycleOperations.id, operationId),
          eq(dataLifecycleOperations.projectId, projectId),
          eq(dataLifecycleOperations.actorId, userId),
          eq(dataLifecycleOperations.state, "previewed"),
        ),
      )
      .returning(),
  )
  if (!cancelled) {
    return yield* new LifecycleRejected({ reason: "Unavailable" })
  }
  return cancelled
})
