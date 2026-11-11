import { AgentAccessStore } from "@flowmark/db/persistence"
import { Effect, Layer } from "effect"
import { persist } from "../../../adapters/persistence-error.js"
import { DelegatedAccessRepository } from "../ports/delegated-access-repository.js"

export const DelegatedAccessRepositoryLive = Layer.effect(
  DelegatedAccessRepository,
  Effect.gen(function* () {
    const store = yield* AgentAccessStore
    return DelegatedAccessRepository.of({
      grantFamily: (input) => persist(store.grantFamily(input)),
      connection: (input) => persist(store.getMcpConnection(input)),
      recordAuthenticated: (input) =>
        persist(store.recordLastAuthenticated(input)),
      consumeBudget: (scope, maximum) =>
        persist(store.consumeMcpBudget(scope, maximum)),
    })
  }),
)
