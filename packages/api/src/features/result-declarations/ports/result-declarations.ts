import { Context, type Effect, type Option } from "effect"
import type {
  SearchFields,
  ResultDeclaration,
  DefinitionImportApply,
  DefinitionImportReceipt,
} from "@flowmarkdev/core"
import type {
  InvalidInput,
  PersistenceError,
  Unauthorized,
} from "../../../errors.js"

export interface ResultDeclarationsService {
  readonly apply: (
    userId: string,
    projectId: string,
    input: DefinitionImportApply,
  ) => Effect.Effect<
    DefinitionImportReceipt,
    InvalidInput | Unauthorized | PersistenceError
  >
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
  ) => Effect.Effect<
    SearchFields,
    InvalidInput | Unauthorized | PersistenceError
  >
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
