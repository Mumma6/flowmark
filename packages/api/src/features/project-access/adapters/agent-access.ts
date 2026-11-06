import { Effect, Layer } from "effect"
import { AgentAccessStore } from "@flowmark/db/persistence"
import {
  persist,
  toPersistenceError,
} from "../../../adapters/persistence-error.js"
import { InvalidInput } from "../../../errors.js"
import { AgentAccess } from "../ports/agent-access.js"

export const AgentAccessLive = Layer.effect(
  AgentAccess,
  Effect.gen(function* () {
    const store = yield* AgentAccessStore
    return AgentAccess.of({
      listConnections: Effect.fn("AgentAccessLive.listConnections")((userId) =>
        persist(store.listConnections(userId)),
      ),
      getConnection: Effect.fn("AgentAccessLive.getConnection")((input) =>
        persist(store.getConnection(input)),
      ),
      submitConsent: Effect.fn("AgentAccessLive.submitConsent")(
        function* (input) {
          return yield* store.submitConsent(input).pipe(
            Effect.catchTag("AgentAccessConsentRejected", (e) =>
              Effect.fail(new InvalidInput({ cause: e.reason })),
            ),
            Effect.catchTag("DatabaseError", (e) =>
              Effect.fail(toPersistenceError(e)),
            ),
          )
        },
      ),
      recordLastAuthenticated: Effect.fn(
        "AgentAccessLive.recordLastAuthenticated",
      )((input) => persist(store.recordLastAuthenticated(input))),
    })
  }),
)
