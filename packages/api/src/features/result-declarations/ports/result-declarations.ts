import { Context, type Effect } from "effect"
import type { ResultDeclaration } from "@flowmarkdev/core"
import type { PersistenceError } from "../../../errors.js"
export class ResultDeclarations extends Context.Service<
  ResultDeclarations,
  {
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
