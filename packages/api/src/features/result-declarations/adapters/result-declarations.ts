import { Effect, Layer } from "effect"
import { ResultDeclarationStore } from "@flowmark/db/persistence"
import { PersistenceError } from "../../../errors.js"
import { ResultDeclarations } from "../ports/result-declarations.js"

export const ResultDeclarationsLive = Layer.effect(
  ResultDeclarations,
  Effect.gen(function* () {
    const store = yield* ResultDeclarationStore
    return ResultDeclarations.of({
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
