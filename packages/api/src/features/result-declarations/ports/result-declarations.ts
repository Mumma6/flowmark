import { Context, type Effect, type Option } from "effect"
import type { SearchFields, ResultDeclaration } from "@flowmarkdev/core"
import type { PersistenceError } from "../../../errors.js"

export interface ResultDeclarationsService {
  readonly find: (
    projectId: string,
    workflow: string,
    revision: string,
  ) => Effect.Effect<Option.Option<ResultDeclaration>, PersistenceError>
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
export class ResultDeclarations extends Context.Service<
  ResultDeclarations,
  ResultDeclarationsService
>()("@flowmark/api/ResultDeclarations") {}
