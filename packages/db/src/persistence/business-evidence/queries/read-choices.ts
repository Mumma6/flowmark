import { eq } from "drizzle-orm"
import { Effect } from "effect"
import {
  workflowResultDeclarations,
  workflowSearchFields,
} from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { EvidenceAccessRejected } from "../types.js"
export const readPublicationChoices = Effect.fn("readPublicationChoices")(
  function* (projectId: string) {
    const db = yield* Database
    const declarations = yield* runQuery(
      DatabaseOperation.BusinessEvidence,
      () =>
        db
          .select({
            workflow: workflowResultDeclarations.workflow,
            declaration: workflowResultDeclarations.declaration,
          })
          .from(workflowResultDeclarations)
          .where(eq(workflowResultDeclarations.projectId, projectId))
          .limit(301),
    )
    const references = yield* runQuery(DatabaseOperation.BusinessEvidence, () =>
      db
        .select({
          workflow: workflowSearchFields.workflow,
          fields: workflowSearchFields.fields,
        })
        .from(workflowSearchFields)
        .where(eq(workflowSearchFields.projectId, projectId))
        .limit(301),
    )
    if (declarations.length > 300 || references.length > 300) {
      return yield* new EvidenceAccessRejected({ reason: "Unavailable" })
    }
    return { declarations, references }
  },
)
