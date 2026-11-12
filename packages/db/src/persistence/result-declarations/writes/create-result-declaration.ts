import { Effect } from "effect"
import type { ResultDeclaration } from "@flowmarkdev/core"
import { workflowResultDeclarations } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { runTransaction } from "../../run-transaction.js"
import { lockDefinitionScope } from "./lock-definition-scope.js"

export const createResultDeclaration = Effect.fn("createResultDeclaration")(
  function* (
    projectId: string,
    workflow: string,
    declaration: ResultDeclaration,
  ) {
    const db = yield* Database
    const rows = yield* runTransaction(
      DatabaseOperation.CreateResultDeclaration,
      (use) => db.transaction(use),
      (tx) =>
        Effect.gen(function* () {
          yield* lockDefinitionScope(tx, projectId, workflow)
          return yield* runQuery(
            DatabaseOperation.CreateResultDeclaration,
            () =>
              tx
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
        }),
    )
    return rows.length === 1
  },
)
