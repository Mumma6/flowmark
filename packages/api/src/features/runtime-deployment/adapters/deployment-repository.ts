import { DeploymentStore } from "@flowmark/db/persistence"
import { Effect, Layer } from "effect"
import { persist } from "../../../adapters/persistence-error.js"
import { DeploymentRepository } from "../ports/deployment-repository.js"

export const DeploymentRepositoryLive = Layer.effect(
  DeploymentRepository,
  Effect.gen(function* () {
    const store = yield* DeploymentStore
    return DeploymentRepository.of({
      rotateBinding: (...args) => persist(store.rotateBinding(...args)),
      record: (input) => persist(store.record(input)),
      read: (...args) => persist(store.read(...args)),
    })
  }),
)
