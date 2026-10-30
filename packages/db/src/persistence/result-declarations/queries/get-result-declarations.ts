import { and, eq } from "drizzle-orm"
import { Effect } from "effect"
import { workflowResultDeclarations } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export const getResultDeclarations = Effect.fn("getResultDeclarations")(
  function* (projectId: string, workflow: string) {
    const db = yield* Database
    const rows = yield* runQuery(DatabaseOperation.ReadResultDeclarations, () =>
      db
        .select({ declaration: workflowResultDeclarations.declaration })
        .from(workflowResultDeclarations)
        .where(
          and(
            eq(workflowResultDeclarations.projectId, projectId),
            eq(workflowResultDeclarations.workflow, workflow),
          ),
        )
        .orderBy(workflowResultDeclarations.createdAt),
    )
    return rows.map(({ declaration }) => declaration)
  },
)
