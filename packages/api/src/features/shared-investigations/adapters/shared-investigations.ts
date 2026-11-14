import { Effect, Layer, Match } from "effect"
import {
  SharedInvestigationStore,
  type SharedInvestigationRejected,
  type DatabaseError,
  type EvidenceAccessRejected,
} from "@flowmark/db/persistence"
import { InvalidInput, Unauthorized } from "../../../errors.js"
import { toPersistenceError } from "../../../adapters/persistence-error.js"
import { withReadSubject } from "../../workflows/adapters/with-read-subject.js"
import {
  SharedInvestigations,
  type SharedInvestigationFailure,
  type SharedQuestionAccess,
} from "../ports/shared-investigations.js"
const persist = <A, R>(
  effect: Effect.Effect<
    A,
    | SharedInvestigationFailure
    | DatabaseError
    | SharedInvestigationRejected
    | EvidenceAccessRejected,
    R
  >,
) =>
  effect.pipe(
    Effect.mapError((error) =>
      Match.value(error).pipe(
        Match.tag("DatabaseError", toPersistenceError),
        Match.tag(
          "EvidenceAccessRejected",
          () =>
            new InvalidInput({
              cause: "Shared investigations are unavailable.",
            }),
        ),
        Match.tag("SharedInvestigationRejected", (error) =>
          error.reason === "Unauthorized"
            ? new Unauthorized({ permission: "read" })
            : new InvalidInput({
                cause:
                  error.reason === "Limit"
                    ? "Shared investigation limit reached (25 per creator, 100 per project)."
                    : "Shared investigations are unavailable.",
              }),
        ),
        Match.orElse((error) => error),
      ),
    ),
  )
export const SharedInvestigationsLive = Layer.effect(
  SharedInvestigations,
  Effect.gen(function* () {
    const store = yield* SharedInvestigationStore
    return SharedInvestigations.of({
      withAccess: (projectId, write, use) =>
        withReadSubject(
          persist(
            store.withAccess(projectId, write, (access) =>
              use({
                role: access.role,
                userId: access.userId,
                revision: access.revision,
                publication: access.publication,
                choices: () => persist(access.choices()),
                records: () => persist(access.records()),
                create: (input) => persist(access.create(input)),
                revoke: (id) => persist(access.revoke(id)),
              } satisfies SharedQuestionAccess),
            ),
          ),
        ),
    })
  }),
)
