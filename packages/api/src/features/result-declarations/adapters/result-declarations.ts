import { Effect, Layer } from "effect"
import { ResultDeclarationStore } from "@flowmark/db/persistence"
import { toPersistenceError } from "../../../adapters/persistence-error.js"
import { ResultDeclarations } from "../ports/result-declarations.js"

export const ResultDeclarationsLive = Layer.effect(
  ResultDeclarations,
  Effect.gen(function* () {
    const store = yield* ResultDeclarationStore
    return ResultDeclarations.of({
      searchFields: (projectId, workflow) =>
        store
          .searchFields(projectId, workflow)
          .pipe(Effect.mapError(toPersistenceError)),
      setSearchFields: (projectId, workflow, fields) =>
        store
          .setSearchFields(projectId, workflow, fields)
          .pipe(Effect.mapError(toPersistenceError)),
      list: (projectId, workflow) =>
        store
          .list(projectId, workflow)
          .pipe(Effect.mapError(toPersistenceError)),
      create: (projectId, workflow, declaration) =>
        store
          .create(projectId, workflow, declaration)
          .pipe(Effect.mapError(toPersistenceError)),
    })
  }),
)
