import { eq } from "drizzle-orm"
import { Effect } from "effect"
import { projectEvidencePublications } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
export const readEvidencePublication = Effect.fn("readEvidencePublication")(
  function* (projectId: string) {
    const db = yield* Database
    const [row] = yield* runQuery(DatabaseOperation.BusinessEvidence, () =>
      db
        .select()
        .from(projectEvidencePublications)
        .where(eq(projectEvidencePublications.projectId, projectId))
        .for("share"),
    )
    return {
      revision: row?.revision ?? 0,
      publication:
        row === undefined ? { results: [], references: [] } : row.publication,
    }
  },
)
