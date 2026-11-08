import { AgentAccessStore } from "@flowmark/db/persistence"
import { Effect, Layer } from "effect"
import {
  persist,
  toPersistenceError,
} from "../../../adapters/persistence-error.js"
import { InvalidInput } from "../../../errors.js"
import { AgentConsentRepository } from "../ports/agent-consent-repository.js"

export const AgentConsentRepositoryLive = Layer.effect(
  AgentConsentRepository,
  Effect.gen(function* () {
    const store = yield* AgentAccessStore
    return AgentConsentRepository.of({
      client: (id) => persist(store.consentClient(id)),
      bindCode: (input) =>
        store.bindConsentCode(input).pipe(
          Effect.catchTag("DatabaseError", (error) =>
            Effect.fail(toPersistenceError(error)),
          ),
          Effect.catchTag("AgentAccessConsentRejected", (error) =>
            Effect.fail(new InvalidInput({ cause: error.reason })),
          ),
        ),
    })
  }),
)
