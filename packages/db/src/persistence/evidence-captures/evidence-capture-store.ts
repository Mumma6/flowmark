import { purgeExpiredCaptures } from "./writes/purge-expired-captures.js"
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
import { captureSource, captureValues } from "./queries/source.js"
import { captureRecords, capturePayload } from "./queries/records.js"
import { insertCapture, deleteCapture } from "./writes/captures.js"
import { EvidenceCaptureRejected } from "./types.js"
import type { CapturedRunEvidence } from "@flowmarkdev/core"
const accessEvidenceCaptures = Effect.fn("accessEvidenceCaptures")(function* (
  projectId: string,
  write: boolean,
) {
  const subject = yield* ProjectReadSubject
  if (!subject || subject.kind === "key") {
    return yield* new EvidenceCaptureRejected({ reason: "Unauthorized" })
  }
  const db = yield* Database
  yield* runQuery(DatabaseOperation.EvidenceCaptures, () =>
    db.execute(sql`SET LOCAL statement_timeout='5s'`),
  )
  yield* runQuery(DatabaseOperation.EvidenceCaptures, () =>
    db.execute(sql`SET LOCAL lock_timeout='3s'`),
  )
  const [member] = yield* runQuery(DatabaseOperation.EvidenceCaptures, () =>
    db.execute<{ role: "owner" | "viewer" | "business" }>(sql`
    SELECT role FROM project_members WHERE project_id=${projectId}::uuid AND user_id=${subject.userId} FOR SHARE`),
  )
  if (!member) {
    return yield* new EvidenceCaptureRejected({ reason: "Unauthorized" })
  }
  const publication = yield* readEvidencePublication(projectId)
  const provide = provideDatabase(db, yield* DatabaseCancellation)
  return {
    role: member.role,
    userId: subject.userId,
    revision: publication.revision,
    publication: publication.publication,
    choices: () => provide(readPublicationChoices(projectId)),
    records: () => provide(captureRecords(projectId, publication.revision)),
    payload: (id: string) =>
      provide(capturePayload(projectId, id, publication.revision)),
    source: (runId: string) =>
      write && subject.kind === "user"
        ? provide(captureSource(projectId, runId))
        : Effect.fail(new EvidenceCaptureRejected({ reason: "Unauthorized" })),
    values: (
      runId: string,
      paths: readonly (readonly string[])[],
      keys: readonly string[],
    ) =>
      write && subject.kind === "user"
        ? provide(captureValues(projectId, runId, paths, keys))
        : Effect.fail(new EvidenceCaptureRejected({ reason: "Unauthorized" })),
    create: (capture: CapturedRunEvidence) =>
      write && subject.kind === "user"
        ? provide(insertCapture(projectId, subject.userId, capture))
        : Effect.fail(new EvidenceCaptureRejected({ reason: "Unauthorized" })),
    purgeExpired: Effect.fn("EvidenceCaptureStore.purgeExpired")(function* () {
      if (!write || subject.kind !== "user" || member.role !== "owner") {
        return yield* new EvidenceCaptureRejected({ reason: "Unauthorized" })
      }
      return yield* provide(purgeExpiredCaptures(projectId))
    }),
    delete: (id: string) =>
      write && subject.kind === "user"
        ? provide(
            deleteCapture(
              projectId,
              subject.userId,
              member.role === "owner",
              id,
            ),
          )
        : Effect.fail(new EvidenceCaptureRejected({ reason: "Unauthorized" })),
  }
})
export type EvidenceCaptureAccess = Effect.Success<
  ReturnType<typeof accessEvidenceCaptures>
>
export class EvidenceCaptureStore extends Context.Service<EvidenceCaptureStore>()(
  "@flowmark/db/EvidenceCaptureStore",
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
          use: (access: EvidenceCaptureAccess) => Effect.Effect<A, E>,
        ) =>
          provide(
            withActiveProject(
              projectId,
              accessEvidenceCaptures(projectId, write).pipe(
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
