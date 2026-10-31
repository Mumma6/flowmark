import { Effect } from "effect"
import type { ResultSelection } from "@flowmarkdev/core"
import { InvalidResultQuery } from "../../database.js"
import { and, eq } from "drizzle-orm"
import { workflowResultDeclarations } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { runQuery } from "../../run-query.js"
import { DatabaseOperation } from "../../database-operation.js"

export const declaredResultField = Effect.fn("declaredResultField")(function* (
  projectId: string,
  workflow: string | undefined,
  revision: string,
  path: readonly string[],
) {
  if (!workflow) {
    return yield* new InvalidResultQuery({
      message: "Select a workflow and declared revision.",
    })
  }
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
  const declarations = rows.map((row) => row.declaration)
  const field = declarations
    .find((entry) => entry.revision === revision)
    ?.fields.find(
      (entry) => JSON.stringify(entry.path) === JSON.stringify(path),
    )
  if (!field) {
    return yield* new InvalidResultQuery({
      message: "Result path is not declared for this workflow/revision.",
    })
  }
  return field
})
export const validateResultSelection = Effect.fn("validateResultSelection")(
  function* (
    projectId: string,
    workflow: string | undefined,
    selection: ResultSelection,
  ) {
    const field = yield* declaredResultField(
      projectId,
      workflow,
      selection.revision,
      selection.path,
    )
    const valid =
      field.kind === "category"
        ? selection.operator === "eq" &&
          typeof selection.value === "string" &&
          selection.reason === undefined &&
          (!field.values || field.values.includes(selection.value))
        : typeof selection.value === "number" &&
          (field.kind === "count"
            ? selection.reason === undefined
            : selection.reason !== undefined &&
              field.values?.includes(selection.reason))
    if (!valid) {
      return yield* new InvalidResultQuery({
        message: "Invalid operator/value for the declared result field.",
      })
    }
    return field
  },
)
