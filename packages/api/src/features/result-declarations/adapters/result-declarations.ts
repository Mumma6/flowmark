import { Effect, Layer, Match } from "effect"
import { ResultDeclarationStore } from "@flowmark/db/persistence"
import type {
  DatabaseError,
  DefinitionImportRejected,
} from "@flowmark/db/persistence"
import {
  persist,
  toPersistenceError,
} from "../../../adapters/persistence-error.js"
import { InvalidInput, Unauthorized } from "../../../errors.js"
import { ResultDeclarations } from "../ports/result-declarations.js"

const declarationWrite = <A>(
  operation: Effect.Effect<A, DatabaseError | DefinitionImportRejected>,
) =>
  operation.pipe(
    Effect.mapError((error) =>
      Match.value(error).pipe(
        Match.tag("DatabaseError", toPersistenceError),
        Match.tag("DefinitionImportRejected", ({ reason }) =>
          Match.value(reason).pipe(
            Match.when(
              "Unauthorized",
              () => new Unauthorized({ permission: "write" }),
            ),
            Match.when(
              "Stale",
              () =>
                new InvalidInput({
                  cause:
                    "This preview is stale or does not match the document. Preview again before applying.",
                }),
            ),
            Match.when(
              "Conflict",
              () =>
                new InvalidInput({
                  cause:
                    "The import conflicts with existing metadata. Use a new revision or preserve existing search permissions.",
                }),
            ),
            Match.when(
              "ProtectedSearchField",
              () =>
                new InvalidInput({
                  cause:
                    "Code-owned search fields cannot be changed or removed in Studio. Preserve their existing configuration.",
                }),
            ),
            Match.exhaustive,
          ),
        ),
        Match.exhaustive,
      ),
    ),
  )

export const ResultDeclarationsLive = Layer.effect(
  ResultDeclarations,
  Effect.gen(function* () {
    const store = yield* ResultDeclarationStore
    return ResultDeclarations.of({
      apply: (userId, projectId, input) =>
        declarationWrite(store.apply(userId, projectId, input)),
      find: (userId, projectId, workflow, revision) =>
        persist(store.find(userId, projectId, workflow, revision)),
      searchFields: (userId, projectId, workflow) =>
        persist(store.searchFields(userId, projectId, workflow)),
      setSearchFields: (userId, projectId, workflow, fields) =>
        declarationWrite(
          store.setSearchFields(userId, projectId, workflow, fields),
        ),
      list: (userId, projectId, workflow) =>
        persist(store.list(userId, projectId, workflow)),
      create: (userId, projectId, workflow, declaration) =>
        persist(store.create(userId, projectId, workflow, declaration)),
    })
  }),
)
