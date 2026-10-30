import { Effect } from "effect"
import { Database, provideDatabase } from "../database.js"
import { getResultDeclarations } from "./queries/get-result-declarations.js"
import { createResultDeclaration } from "./writes/create-result-declaration.js"
import type { ResultDeclaration } from "@flowmarkdev/core"

export class ResultDeclarationStore extends Effect.Service<ResultDeclarationStore>()(
  "@flowmark/db/ResultDeclarationStore",
  {
    effect: Effect.gen(function* () {
      const provide = provideDatabase(yield* Database)
      return {
        list: (projectId: string, workflow: string) =>
          provide(getResultDeclarations(projectId, workflow)),
        create: (
          projectId: string,
          workflow: string,
          declaration: ResultDeclaration,
        ) => provide(createResultDeclaration(projectId, workflow, declaration)),
      }
    }),
  },
) {}
