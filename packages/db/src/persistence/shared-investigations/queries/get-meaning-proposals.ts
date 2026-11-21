import { and, desc, eq, isNotNull, isNull } from "drizzle-orm"
import { Effect } from "effect"
import {
  sharedInvestigations,
  user,
  workflowResultDeclarations,
} from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export const getMeaningProposals = Effect.fn("getMeaningProposals")(function* (
  projectId: string,
  creatorId?: string,
  id?: string,
) {
  const db = yield* Database
  return yield* runQuery(DatabaseOperation.SharedInvestigations, () =>
    db
      .select({
        id: sharedInvestigations.id,
        creatorId: sharedInvestigations.creatorId,
        proposal: sharedInvestigations.meaningProposal,
        resolution: sharedInvestigations.proposalResolution,
      })
      .from(sharedInvestigations)
      .innerJoin(user, eq(user.id, sharedInvestigations.creatorId))
      .where(
        and(
          eq(sharedInvestigations.projectId, projectId),
          isNotNull(sharedInvestigations.meaningProposal),
          isNull(user.lifecycleOperationId),
          creatorId ? eq(sharedInvestigations.creatorId, creatorId) : undefined,
          id ? eq(sharedInvestigations.id, id) : undefined,
        ),
      )
      .orderBy(
        desc(sharedInvestigations.createdAt),
        desc(sharedInvestigations.id),
      )
      .limit(id ? 1 : 100),
  )
})

export const getMeaningProposalHead = Effect.fn("getMeaningProposalHead")(
  function* (projectId: string, workflow: string) {
    const db = yield* Database
    const [head] = yield* runQuery(
      DatabaseOperation.ReadResultDeclarations,
      () =>
        db
          .select({
            revision: workflowResultDeclarations.revision,
            source: workflowResultDeclarations.source,
          })
          .from(workflowResultDeclarations)
          .where(
            and(
              eq(workflowResultDeclarations.projectId, projectId),
              eq(workflowResultDeclarations.workflow, workflow),
            ),
          )
          .orderBy(
            desc(workflowResultDeclarations.createdAt),
            desc(workflowResultDeclarations.id),
          )
          .limit(1),
    )
    return head ?? null
  },
)
