import { and, eq } from "drizzle-orm"
import { Array, Effect, Option } from "effect"
import { canonicalSearchFields, type SearchFields } from "@flowmarkdev/core"
import { workflowSearchFields } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { runTransaction } from "../../run-transaction.js"
import { DefinitionImportRejected } from "../definition-import-error.js"
import { lockDefinitionScope } from "./lock-definition-scope.js"
export const setSearchFields = Effect.fn("setSearchFields")(function* (
  projectId: string,
  workflow: string,
  fields: SearchFields,
) {
  const db = yield* Database
  return yield* runTransaction(
    DatabaseOperation.SetSearchFields,
    (use) => db.transaction(use),
    (tx) =>
      Effect.gen(function* () {
        yield* lockDefinitionScope(tx, projectId, workflow)
        const rows = yield* runQuery(DatabaseOperation.ReadSearchFields, () =>
          tx
            .select({
              fields: workflowSearchFields.fields,
              sources: workflowSearchFields.sources,
            })
            .from(workflowSearchFields)
            .where(
              and(
                eq(workflowSearchFields.projectId, projectId),
                eq(workflowSearchFields.workflow, workflow),
              ),
            )
            .limit(1),
        )
        const current = Option.getOrElse(Array.head(rows), () => ({
          fields: [],
          sources: {},
        }))
        const protectedFields = Array.filter(current.fields, (field) =>
          Object.hasOwn(current.sources, field.key),
        )
        const modifiesOwnedField = Array.some(
          protectedFields,
          (previous) =>
            !Array.some(
              fields,
              (next) =>
                next.key === previous.key &&
                JSON.stringify(canonicalSearchFields([next])) ===
                  JSON.stringify(canonicalSearchFields([previous])),
            ),
        )
        if (modifiesOwnedField) {
          return yield* new DefinitionImportRejected({
            reason: "ProtectedSearchField",
          })
        }
        yield* runQuery(DatabaseOperation.SetSearchFields, () =>
          tx
            .insert(workflowSearchFields)
            .values({ projectId, workflow, fields })
            .onConflictDoUpdate({
              target: [
                workflowSearchFields.projectId,
                workflowSearchFields.workflow,
              ],
              set: { fields },
            }),
        )
        return fields
      }),
  )
})
