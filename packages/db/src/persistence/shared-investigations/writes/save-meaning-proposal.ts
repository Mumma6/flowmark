import { and, eq, isNotNull, isNull, sql } from "drizzle-orm"
import { Effect } from "effect"
import type {
  MeaningProposalResolution,
  StoredMeaningProposal,
} from "@flowmarkdev/core"
import { sharedInvestigations } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { SharedInvestigationRejected } from "../types.js"

export const saveMeaningProposal = Effect.fn("saveMeaningProposal")(function* (
  projectId: string,
  creatorId: string,
  proposal: StoredMeaningProposal,
) {
  const db = yield* Database
  const [count] = yield* runQuery(DatabaseOperation.SharedInvestigations, () =>
    db.execute<{ total: number; owned: number }>(sql`
    SELECT count(*)::int AS total, count(*) FILTER(WHERE creator_id=${creatorId})::int AS owned
    FROM shared_investigations WHERE project_id=${projectId}::uuid AND meaning_proposal IS NOT NULL
  `),
  )
  if (!count || count.total >= 100 || count.owned >= 25) {
    return yield* new SharedInvestigationRejected({ reason: "Limit" })
  }
  const [row] = yield* runQuery(DatabaseOperation.SharedInvestigations, () =>
    db
      .insert(sharedInvestigations)
      .values({
        id: proposal.command.id,
        creatorId,
        projectId,
        title: proposal.command.label,
        selection: {
          version: 1,
          depth: "business",
          query: { kind: "run", runId: proposal.command.runId },
        },
        meaningProposal: proposal,
      })
      .onConflictDoNothing()
      .returning({ id: sharedInvestigations.id }),
  )
  if (!row) {
    return yield* new SharedInvestigationRejected({ reason: "Unavailable" })
  }
  return row
})

export const resolveMeaningProposal = Effect.fn("resolveMeaningProposal")(
  function* (
    projectId: string,
    ownerId: string,
    id: string,
    resolution: MeaningProposalResolution,
  ) {
    const db = yield* Database
    const [row] = yield* runQuery(DatabaseOperation.SharedInvestigations, () =>
      db
        .update(sharedInvestigations)
        .set({
          proposalResolution: resolution,
          proposalResolvedBy: ownerId,
          proposalResolvedAt: new Date(),
        })
        .where(
          and(
            eq(sharedInvestigations.projectId, projectId),
            eq(sharedInvestigations.id, id),
            isNotNull(sharedInvestigations.meaningProposal),
            isNull(sharedInvestigations.proposalResolution),
          ),
        )
        .returning({ id: sharedInvestigations.id }),
    )
    if (!row) {
      return yield* new SharedInvestigationRejected({ reason: "Unavailable" })
    }
    return { ...row, resolution }
  },
)
