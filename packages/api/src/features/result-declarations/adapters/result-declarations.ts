import { Effect, Layer } from "effect"
import { ResultDeclarationStore } from "@flowmark/db/persistence"
import { persist } from "../../../adapters/persistence-error.js"
import { ResultDeclarations } from "../ports/result-declarations.js"

export const ResultDeclarationsLive = Layer.effect(
  ResultDeclarations,
  Effect.gen(function* () {
    const store = yield* ResultDeclarationStore
    return ResultDeclarations.of({
      find: (projectId, workflow, revision) =>
        persist(store.find(projectId, workflow, revision)),
      searchFields: (projectId, workflow) =>
        persist(store.searchFields(projectId, workflow)),
      setSearchFields: (projectId, workflow, fields) =>
        persist(store.setSearchFields(projectId, workflow, fields)),
      list: (projectId, workflow) => persist(store.list(projectId, workflow)),
      create: (projectId, workflow, declaration) =>
        persist(store.create(projectId, workflow, declaration)),
    })
  }),
)
