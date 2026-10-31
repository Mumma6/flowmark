import { Context, Effect, Layer } from "effect"
import { Database, provideDatabase } from "../database.js"
import { getResultDeclarations } from "./queries/get-result-declarations.js"
import { createResultDeclaration } from "./writes/create-result-declaration.js"
import { getSearchFields } from "./queries/get-search-fields.js"
import { setSearchFields } from "./writes/set-search-fields.js"
import type { SearchFields, ResultDeclaration } from "@flowmarkdev/core"
export class ResultDeclarationStore extends Context.Service<ResultDeclarationStore>()(
  "@flowmark/db/ResultDeclarationStore",
  {
    make: Effect.gen(function* () {
      const provide = provideDatabase(yield* Database)
      return {
        searchFields: (projectId: string, workflow: string) =>
          provide(getSearchFields(projectId, workflow)),
        setSearchFields: (
          projectId: string,
          workflow: string,
          fields: SearchFields,
        ) => provide(setSearchFields(projectId, workflow, fields)),
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
) {
  static readonly layer = Layer.effect(this, this.make)
}
