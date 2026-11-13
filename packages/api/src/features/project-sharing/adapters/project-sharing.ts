import { Effect, Layer, Match, Option } from "effect"
import {
  ProjectSharingStore,
  type SharingRejected,
  type DatabaseError,
} from "@flowmark/db/persistence"
import {
  InvalidInput,
  ManagementRateLimited,
  Unauthorized,
} from "../../../errors.js"
import { toPersistenceError } from "../../../adapters/persistence-error.js"
import { ProjectSharingRepository } from "../ports/project-sharing.js"

const sharing = <A>(
  operation: Effect.Effect<A, DatabaseError | SharingRejected>,
) =>
  operation.pipe(
    Effect.mapError((error) =>
      Match.value(error).pipe(
        Match.tag("DatabaseError", toPersistenceError),
        Match.tag("SharingRejected", ({ reason }) =>
          Match.value(reason).pipe(
            Match.when(
              "Unauthorized",
              () => new Unauthorized({ permission: "read" }),
            ),
            Match.when(
              "LimitReached",
              () => new ManagementRateLimited({ retryAfter: 900 }),
            ),
            Match.orElse(
              () =>
                new InvalidInput({
                  cause:
                    "This invitation or project is unavailable. Check your signed-in account or ask the owner for a new invitation.",
                }),
            ),
          ),
        ),
        Match.exhaustive,
      ),
    ),
  )
export const ProjectSharingRepositoryLive = Layer.effect(
  ProjectSharingRepository,
  Effect.gen(function* () {
    const store = yield* ProjectSharingStore
    return ProjectSharingRepository.of({
      list: (userId, projectId) => sharing(store.list(userId, projectId)),
      invite: (userId, projectId, email, hash, role) =>
        sharing(store.invite(userId, projectId, email, hash, role)).pipe(
          Effect.map(
            Option.map(({ invitation, projectName, inviterName }) => ({
              id: invitation.id,
              email: invitation.email,
              role: invitation.role,
              projectName,
              inviterName,
            })),
          ),
        ),
      delivery: (id, hash, status) => sharing(store.delivery(id, hash, status)),
      review: (userId, id, hash, action) =>
        sharing(store.review(userId, id, hash, action)),
      remove: (userId, projectId, targetId) =>
        sharing(store.remove(userId, projectId, targetId)),
      revoke: (userId, projectId, id) =>
        sharing(store.revoke(userId, projectId, id)),
      budget: (hash, window, max) => sharing(store.budget(hash, window, max)),
      prune: () => sharing(store.prune()),
    })
  }),
)
