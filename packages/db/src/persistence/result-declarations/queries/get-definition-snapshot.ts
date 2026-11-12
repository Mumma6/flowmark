import { and, eq } from "drizzle-orm"
import { Array, Effect, Option } from "effect"
import type { DefinitionImport } from "@flowmarkdev/core"
import {
  workflowResultDeclarations,
  workflowSearchFields,
} from "../../../schema/index.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import type { DefinitionTransaction } from "../writes/lock-definition-scope.js"

export const getDefinitionSnapshot = Effect.fn("getDefinitionSnapshot")(
  function* (
    tx: DefinitionTransaction,
    projectId: string,
    input: DefinitionImport,
  ) {
    const fields = yield* runQuery(DatabaseOperation.ReadSearchFields, () =>
      tx
        .select({
          fields: workflowSearchFields.fields,
          sources: workflowSearchFields.sources,
        })
        .from(workflowSearchFields)
        .where(
          and(
            eq(workflowSearchFields.projectId, projectId),
            eq(workflowSearchFields.workflow, input.workflow),
          ),
        )
        .limit(1),
    )
    const revision = input.result?.revision
    const declarations = yield* Option.match(Option.fromUndefinedOr(revision), {
      onNone: () => Effect.succeed([]),
      onSome: (value) =>
        runQuery(DatabaseOperation.ReadResultDeclarations, () =>
          tx
            .select({
              declaration: workflowResultDeclarations.declaration,
            })
            .from(workflowResultDeclarations)
            .where(
              and(
                eq(workflowResultDeclarations.projectId, projectId),
                eq(workflowResultDeclarations.workflow, input.workflow),
                eq(workflowResultDeclarations.revision, value),
              ),
            )
            .limit(1),
        ),
    })
    const current = Array.head(fields)
    return {
      result: Array.head(declarations).pipe(
        Option.map((row) => row.declaration),
      ),
      searchFields: Option.match(current, {
        onNone: () => [],
        onSome: (row) => row.fields,
      }),
      sources: Option.match(current, {
        onNone: () => ({}) as Readonly<Record<string, string>>,
        onSome: (row) => row.sources,
      }),
    }
  },
)
