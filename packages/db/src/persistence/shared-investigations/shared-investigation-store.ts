import { sql } from "drizzle-orm"
import { Context, Effect, Layer } from "effect"
import { Database, DatabaseCancellation, provideDatabase } from "../database.js"
import { runQuery } from "../run-query.js"
import { DatabaseOperation } from "../database-operation.js"
import { withActiveProject } from "../data-lifecycle/with-active-project.js"
import {
  ProjectReadDepth,
  ProjectReadSubject,
} from "../project-access/read-subject.js"
import { readEvidencePublication } from "../business-evidence/queries/read-publication.js"
import { readPublicationChoices } from "../business-evidence/queries/read-choices.js"
import { getSharedInvestigations } from "./queries/get-shared-investigations.js"
import { createSharedInvestigation } from "./writes/create-shared-investigation.js"
import { revokeSharedInvestigation } from "./writes/revoke-shared-investigation.js"
import { SharedInvestigationRejected } from "./types.js"
import type { ShareInvestigation } from "@flowmarkdev/core"
const accessSharedInvestigations = Effect.fn("accessSharedInvestigations")(
  function* (projectId: string, write: boolean) {
    const subject = yield* ProjectReadSubject
    if (!subject || subject.kind === "key") {
      return yield* new SharedInvestigationRejected({ reason: "Unauthorized" })
    }
    const db = yield* Database
    yield* runQuery(DatabaseOperation.SharedInvestigations, () =>
      db.execute(sql`SET LOCAL statement_timeout='5s'`),
    )
    yield* runQuery(DatabaseOperation.SharedInvestigations, () =>
      db.execute(sql`SET LOCAL lock_timeout='3s'`),
    )
    const [member] = yield* runQuery(
      DatabaseOperation.SharedInvestigations,
      () =>
        db.execute<{ role: "owner" | "viewer" | "business" }>(sql`
    SELECT role FROM project_members WHERE project_id=${projectId}::uuid AND user_id=${subject.userId} FOR SHARE`),
    )
    if (!member) {
      return yield* new SharedInvestigationRejected({ reason: "Unauthorized" })
    }
    const publication = yield* readEvidencePublication(projectId)
    const provide = provideDatabase(db, yield* DatabaseCancellation)
    return {
      role: member.role,
      userId: subject.userId,
      revision: publication.revision,
      publication: publication.publication,
      choices: () => provide(readPublicationChoices(projectId)),
      records: () => provide(getSharedInvestigations(projectId)),
      create: (input: ShareInvestigation) =>
        write && subject.kind === "user"
          ? provide(createSharedInvestigation(projectId, subject.userId, input))
          : Effect.fail(
              new SharedInvestigationRejected({ reason: "Unauthorized" }),
            ),
      revoke: (id: string) =>
        write && subject.kind === "user"
          ? provide(
              revokeSharedInvestigation(
                projectId,
                subject.userId,
                member.role === "owner",
                id,
              ),
            )
          : Effect.fail(
              new SharedInvestigationRejected({ reason: "Unauthorized" }),
            ),
    }
  },
)
export type SharedInvestigationAccess = Effect.Success<
  ReturnType<typeof accessSharedInvestigations>
>
export class SharedInvestigationStore extends Context.Service<SharedInvestigationStore>()(
  "@flowmark/db/SharedInvestigationStore",
  {
    make: Effect.gen(function* () {
      const provide = provideDatabase(
        yield* Database,
        yield* DatabaseCancellation,
      )
      return {
        withAccess: <A, E>(
          projectId: string,
          write: boolean,
          use: (access: SharedInvestigationAccess) => Effect.Effect<A, E>,
        ) =>
          provide(
            withActiveProject(
              projectId,
              accessSharedInvestigations(projectId, write).pipe(
                Effect.flatMap(use),
              ),
              "current",
              write ? "update" : "share",
            ),
          ).pipe(Effect.provideService(ProjectReadDepth, "business")),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
