import { Effect, Layer } from "effect"
import { ResultDeclarationStore } from "@flowmark/db/persistence"
import { PersistenceError } from "../../../errors.js"
import { ResultDeclarations } from "../ports/result-declarations.js"

export const ResultDeclarationsLive = Layer.effect(
  ResultDeclarations,
  Effect.gen(function* () {
    const store = yield* ResultDeclarationStore
    const persistenceError = (error: { operation: string; cause: unknown }) =>
      new PersistenceError(error)
    return ResultDeclarations.of({
      searchFields: (projectId, workflow) =>
        store
          .searchFields(projectId, workflow)
          .pipe(Effect.mapError(persistenceError)),
      setSearchFields: (projectId, workflow, fields) =>
        store
          .setSearchFields(projectId, workflow, fields)
          .pipe(Effect.mapError(persistenceError)),
      list: (projectId, workflow) =>
        store.list(projectId, workflow).pipe(
          Effect.mapError(
            (error) =>
              new PersistenceError({
                operation: error.operation,
                cause: error.cause,
              }),
          ),
        ),
      create: (projectId, workflow, declaration) =>
        store.create(projectId, workflow, declaration).pipe(
          Effect.mapError(
            (error) =>
              new PersistenceError({
                operation: error.operation,
                cause: error.cause,
              }),
          ),
        ),
    })
  }),
)
