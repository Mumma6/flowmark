import { Effect, Layer, Match } from "effect"
import {
  BusinessEvidenceStore,
  type DatabaseError,
  type EvidenceAccessRejected,
  type InvalidResultQuery,
} from "@flowmark/db/persistence"
import { InvalidInput, Unauthorized } from "../../../errors.js"
import { toPersistenceError } from "../../../adapters/persistence-error.js"
import { withReadSubject } from "../../workflows/adapters/with-read-subject.js"
import {
  BusinessEvidenceRepository,
  type EvidenceAccess,
  type BusinessEvidenceError,
} from "../ports/business-evidence.js"
const persist = <A, R>(
  operation: Effect.Effect<
    A,
    | BusinessEvidenceError
    | DatabaseError
    | EvidenceAccessRejected
    | InvalidResultQuery,
    R
  >,
) =>
  operation.pipe(
    Effect.mapError((error) =>
      Match.value(error).pipe(
        Match.tag("DatabaseError", toPersistenceError),
        Match.tag("EvidenceAccessRejected", (error) =>
          error.reason === "Unauthorized"
            ? new Unauthorized({ permission: "read" })
            : new InvalidInput({
                cause:
                  "The publication changed or is unavailable. Refresh before continuing.",
              }),
        ),
        Match.tag(
          "InvalidResultQuery",
          () =>
            new InvalidInput({
              cause: "Published evidence is unavailable for this selection.",
            }),
        ),
        Match.orElse((error) => error),
      ),
    ),
  )
export const BusinessEvidenceRepositoryLive = Layer.effect(
  BusinessEvidenceRepository,
  Effect.gen(function* () {
    const store = yield* BusinessEvidenceStore
    return BusinessEvidenceRepository.of({
      withRead: (projectId, use) =>
        withReadSubject(
          persist(
            store.withRead(projectId, (access) =>
              use({
                revision: access.revision,
                publication: access.publication,
                role: access.role,
                choices: () => persist(access.choices()),
                workflows: (workflow) => persist(access.workflows(workflow)),
                runs: (q) => persist(access.runs(q)),
                run: (id) => persist(access.run(id)),
                journey: (q) => persist(access.journey(q)),
                insights: (q) => persist(access.insights(q)),
                comparisonEvidence: (id, days) =>
                  persist(access.comparisonEvidence(id, days)),
              } satisfies EvidenceAccess),
            ),
          ),
        ),
      configuration: (userId, projectId) =>
        persist(store.configuration(userId, projectId)),
      replace: (userId, projectId, revision, publication, validate) =>
        persist(
          store.replace(userId, projectId, revision, publication, validate),
        ),
    })
  }),
)
