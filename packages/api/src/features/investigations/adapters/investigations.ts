import { Effect, Layer, Match } from "effect"
import {
  InvestigationStore,
  type DatabaseError,
  type InvestigationRejected,
} from "@flowmark/db/persistence"
import { InvalidInput, Unauthorized } from "../../../errors.js"
import { toPersistenceError } from "../../../adapters/persistence-error.js"
import { Investigations } from "../ports/investigations.js"
const translate = <A>(
  operation: Effect.Effect<A, DatabaseError | InvestigationRejected>,
) =>
  operation.pipe(
    Effect.mapError((error) =>
      Match.value(error).pipe(
        Match.tag("DatabaseError", toPersistenceError),
        Match.tag("InvestigationRejected", ({ reason }) =>
          Match.value(reason).pipe(
            Match.when(
              "Unauthorized",
              () => new Unauthorized({ permission: "read" }),
            ),
            Match.when(
              "Limit",
              () =>
                new InvalidInput({
                  cause:
                    "This account already has 100 saved investigations in this project. Delete an entry before saving another.",
                }),
            ),
            Match.when(
              "InvalidCursor",
              () =>
                new InvalidInput({
                  cause:
                    "This saved-investigation cursor is invalid or no longer retained. Restart the list.",
                }),
            ),
            Match.exhaustive,
          ),
        ),
        Match.exhaustive,
      ),
    ),
  )
export const InvestigationsLive = Layer.effect(
  Investigations,
  Effect.gen(function* () {
    const store = yield* InvestigationStore
    return Investigations.of({
      save: (userId, projectId, input) =>
        translate(store.save(userId, projectId, input)),
      get: (userId, projectId, id, depth) =>
        translate(store.get(userId, projectId, id, depth)),
      list: (userId, projectId, input) =>
        translate(store.list(userId, projectId, input)),
      delete: (userId, projectId, id) =>
        translate(store.delete(userId, projectId, id)),
    })
  }),
)
