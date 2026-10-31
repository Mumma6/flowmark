import { Context, type Effect } from "effect"
import type { SearchFields, ResultDeclaration } from "@flowmarkdev/core"
import type { PersistenceError } from "../../../errors.js"
export class ResultDeclarations extends Context.Service<
  ResultDeclarations,
  {
    readonly searchFields: (
      projectId: string,
      workflow: string,
    ) => Effect.Effect<SearchFields, PersistenceError>
    readonly setSearchFields: (
      projectId: string,
      workflow: string,
      fields: SearchFields,
    ) => Effect.Effect<SearchFields, PersistenceError>
    readonly list: (
      projectId: string,
      workflow: string,
    ) => Effect.Effect<ReadonlyArray<ResultDeclaration>, PersistenceError>
    readonly create: (
      projectId: string,
      workflow: string,
      declaration: ResultDeclaration,
    ) => Effect.Effect<boolean, PersistenceError>
  }
>()("@flowmark/api/ResultDeclarations") {}
