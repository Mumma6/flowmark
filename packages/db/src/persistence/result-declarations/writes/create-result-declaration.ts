import { Effect } from "effect"
import type { ResultDeclaration } from "@flowmarkdev/core"
import { workflowResultDeclarations } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export const createResultDeclaration = Effect.fn("createResultDeclaration")(
  function* (
    projectId: string,
    workflow: string,
    declaration: ResultDeclaration,
  ) {
    const db = yield* Database
    const rows = yield* runQuery(
      DatabaseOperation.CreateResultDeclaration,
      () =>
        db
          .insert(workflowResultDeclarations)
          .values({
            projectId,
            workflow,
            revision: declaration.revision,
            declaration,
          })
          .onConflictDoNothing()
          .returning({ id: workflowResultDeclarations.id }),
    )
    return rows.length === 1
  },
)
