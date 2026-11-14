import { sql } from "drizzle-orm"
import { Context, Effect, Layer } from "effect"
import {
  projectEvidencePublications,
  projectMembers,
} from "../../schema/index.js"
import { Database, DatabaseCancellation, provideDatabase } from "../database.js"
import { DatabaseOperation } from "../database-operation.js"
import { runQuery } from "../run-query.js"
import { withActiveProject } from "../data-lifecycle/with-active-project.js"
import { withOwnerProject } from "../project-access/with-owner-project.js"
import {
  ProjectReadDepth,
  ProjectReadSubject,
} from "../project-access/read-subject.js"
import { listRuns } from "../workflows/queries/list-runs.js"
import { readBusinessWorkflows } from "./queries/read-workflows.js"
import { getReferenceJourney } from "../workflows/queries/get-reference-journey.js"
import { getBusinessInsights } from "../workflows/queries/get-business-insights.js"
import { getRunComparisonEvidence } from "../workflows/queries/get-run-comparison-evidence.js"
import { readEvidencePublication } from "./queries/read-publication.js"
import { readPublicationChoices } from "./queries/read-choices.js"
import { readBusinessRunSource } from "./queries/read-run.js"
import { EvidenceAccessRejected } from "./types.js"
const makeAccess = Effect.fn("BusinessEvidence.access")(function* (
  projectId: string,
) {
  const tx = yield* Database
  yield* runQuery(DatabaseOperation.BusinessEvidence, () =>
    tx.execute(sql`SET LOCAL statement_timeout = '5s'`),
  )
  yield* runQuery(DatabaseOperation.BusinessEvidence, () =>
    tx.execute(sql`SET LOCAL lock_timeout = '3s'`),
  )
  const subject = yield* ProjectReadSubject
  if (!subject) {
    return yield* new EvidenceAccessRejected({ reason: "Unauthorized" })
  }
  const [member] =
    subject.kind === "key"
      ? [{ role: "viewer" as const }]
      : yield* runQuery(DatabaseOperation.BusinessEvidence, () =>
          tx
            .select({ role: projectMembers.role })
            .from(projectMembers)
            .where(
              sql`${projectMembers.projectId}=${projectId}::uuid AND ${projectMembers.userId}=${subject.userId}`,
            )
            .for("share"),
        )
  if (!member) {
    return yield* new EvidenceAccessRejected({ reason: "Unauthorized" })
  }
  const publication = yield* readEvidencePublication(projectId)
  const provide = provideDatabase(tx, yield* DatabaseCancellation)
  return {
    ...publication,
    role: member.role,
    choices: () => provide(readPublicationChoices(projectId)),
    workflows: (workflow?: string) =>
      provide(readBusinessWorkflows(projectId, workflow)),
    runs: (query: Parameters<typeof listRuns>[1]) =>
      provide(listRuns(projectId, query)),
    run: (id: string) => provide(readBusinessRunSource(projectId, id)),
    journey: (query: Parameters<typeof getReferenceJourney>[1]) =>
      provide(getReferenceJourney(projectId, query)),
    insights: (query: Parameters<typeof getBusinessInsights>[1]) =>
      provide(getBusinessInsights(projectId, query)),
    comparisonEvidence: (id: string, days: number) =>
      provide(
        getRunComparisonEvidence(projectId, id, {
          days,
          environment: "all",
          sameRelease: false,
        }),
      ),
  }
})
export type EvidenceReadAccess = Effect.Success<ReturnType<typeof makeAccess>>
export type PublicationChoices = Effect.Success<
  ReturnType<typeof readPublicationChoices>
>
export class BusinessEvidenceStore extends Context.Service<BusinessEvidenceStore>()(
  "@flowmark/db/BusinessEvidenceStore",
  {
    make: Effect.gen(function* () {
      const provide = provideDatabase(
        yield* Database,
        yield* DatabaseCancellation,
      )
      return {
        withRead: <A, E>(
          projectId: string,
          use: (access: EvidenceReadAccess) => Effect.Effect<A, E>,
        ) =>
          provide(
            withActiveProject(
              projectId,
              makeAccess(projectId).pipe(Effect.flatMap(use)),
              "current",
            ),
          ).pipe(Effect.provideService(ProjectReadDepth, "business")),
        configuration: (userId: string, projectId: string) =>
          provide(
            withOwnerProject(
              userId,
              projectId,
              Effect.gen(function* () {
                return {
                  ...(yield* readEvidencePublication(projectId)),
                  choices: yield* readPublicationChoices(projectId),
                }
              }),
            ),
          ),
        replace: <E>(
          userId: string,
          projectId: string,
          expectedRevision: number,
          publication: unknown,
          validate: (choices: PublicationChoices) => Effect.Effect<void, E>,
        ) =>
          provide(
            withOwnerProject(
              userId,
              projectId,
              Effect.gen(function* () {
                const db = yield* Database
                const current = yield* readEvidencePublication(projectId)
                if (current.revision !== expectedRevision) {
                  return yield* new EvidenceAccessRejected({ reason: "Stale" })
                }
                yield* validate(yield* readPublicationChoices(projectId))
                const revision = current.revision + 1
                yield* runQuery(DatabaseOperation.BusinessEvidence, () =>
                  db
                    .insert(projectEvidencePublications)
                    .values({ projectId, revision, publication })
                    .onConflictDoUpdate({
                      target: projectEvidencePublications.projectId,
                      set: { revision, publication, updatedAt: new Date() },
                    }),
                )
                return { revision, publication }
              }),
              true,
            ),
          ),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
