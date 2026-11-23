import { RepositoryInstallationStore } from "@flowmark/db/persistence"
import { Effect, Layer } from "effect"
import { persist } from "../../../adapters/persistence-error.js"
import { RepositoryInstallationRepository } from "../ports/repository-installation-repository.js"

export const RepositoryInstallationRepositoryLive = Layer.effect(
  RepositoryInstallationRepository,
  Effect.gen(function* () {
    const store = yield* RepositoryInstallationStore
    return RepositoryInstallationRepository.of({
      list: (...args) => persist(store.list(...args)),
      get: (...args) => persist(store.get(...args)),
      getForProject: (...args) => persist(store.getForProject(...args)),
      upsert: (...args) => persist(store.upsert(...args)),
      recordDelivery: (...args) => persist(store.recordDelivery(...args)),
      recordPr: (...args) => persist(store.recordPr(...args)),
      recordVerification: (...args) =>
        persist(store.recordVerification(...args)),
      revoke: (...args) => persist(store.revoke(...args)),
    })
  }),
)
