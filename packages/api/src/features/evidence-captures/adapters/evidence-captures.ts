import { Effect, Layer, Match } from "effect"
import {
  EvidenceCaptureStore,
  type EvidenceCaptureRejected,
  type DatabaseError,
  type EvidenceAccessRejected,
} from "@flowmark/db/persistence"
import { assertLocalEvidenceCaptureTarget } from "@flowmark/db/capture-environment"
import { InvalidInput, Unauthorized } from "../../../errors.js"
import { toPersistenceError } from "../../../adapters/persistence-error.js"
import { withReadSubject } from "../../workflows/adapters/with-read-subject.js"
import {
  EvidenceCaptures,
  EvidenceCaptureAdmission,
  type CaptureFailure,
  type CaptureAccess,
} from "../ports/evidence-captures.js"
const persist = <A, R>(
  effect: Effect.Effect<
    A,
    | CaptureFailure
    | DatabaseError
    | EvidenceCaptureRejected
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
          () => new InvalidInput({ cause: "Evidence capture unavailable." }),
        ),
        Match.tag("EvidenceCaptureRejected", (error) =>
          error.reason === "Unauthorized"
            ? new Unauthorized({ permission: "read" })
            : new InvalidInput({
                cause: Match.value(error.reason).pipe(
                  Match.when(
                    "Limit",
                    () =>
                      "Capture limit reached (20 per creator, 100 per project). Delete an existing capture first.",
                  ),
                  Match.when(
                    "Oversized",
                    () =>
                      "Published evidence exceeds the 64 KiB capture limit.",
                  ),
                  Match.orElse(() => "Evidence capture unavailable."),
                ),
              }),
        ),
        Match.orElse((error) => error),
      ),
    ),
  )
export const EvidenceCapturesLive = Layer.effect(
  EvidenceCaptures,
  Effect.gen(function* () {
    const store = yield* EvidenceCaptureStore
    return EvidenceCaptures.of({
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
                payload: (id) => persist(access.payload(id)),
                source: (id) => persist(access.source(id)),
                values: (id, paths, keys) =>
                  persist(access.values(id, paths, keys)),
                create: (capture) => persist(access.create(capture)),
                delete: (id) => persist(access.delete(id)),
              } satisfies CaptureAccess),
            ),
          ),
        ),
    })
  }),
)
export const EvidenceCaptureAdmissionLive = Layer.succeed(
  EvidenceCaptureAdmission,
  EvidenceCaptureAdmission.of({
    local: () =>
      assertLocalEvidenceCaptureTarget().pipe(
        Effect.as(true),
        Effect.catch(() => Effect.succeed(false)),
      ),
  }),
)
