import { and, eq } from "drizzle-orm"
import { Array, Effect, Option } from "effect"
import { workflowResultDeclarations } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export const getResultDeclaration = Effect.fn("getResultDeclaration")(
  function* (projectId: string, workflow: string, revision: string) {
    const db = yield* Database
    const rows = yield* runQuery(DatabaseOperation.ReadResultDeclarations, () =>
      db
        .select({ declaration: workflowResultDeclarations.declaration })
        .from(workflowResultDeclarations)
        .where(
          and(
            eq(workflowResultDeclarations.projectId, projectId),
            eq(workflowResultDeclarations.workflow, workflow),
            eq(workflowResultDeclarations.revision, revision),
          ),
        )
        .limit(1),
    )
    return Array.head(rows).pipe(Option.map((row) => row.declaration))
  },
)
