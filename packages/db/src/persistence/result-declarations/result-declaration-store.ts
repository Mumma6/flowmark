import { ProjectReadSubject } from "../project-access/read-subject.js"
import { withOwnerProject } from "../project-access/with-owner-project.js"
import { withActiveProject } from "../data-lifecycle/with-active-project.js"
import { Context, Effect, Layer } from "effect"
import { DatabaseCancellation, Database, provideDatabase } from "../database.js"
import { getResultDeclarations } from "./queries/get-result-declarations.js"
import { getResultDeclaration } from "./queries/get-result-declaration.js"
import { createResultDeclaration } from "./writes/create-result-declaration.js"
import { getSearchFields } from "./queries/get-search-fields.js"
import { setSearchFields } from "./writes/set-search-fields.js"
import { applyDefinitionImport } from "./writes/apply-definition-import.js"
import type { DefinitionImportApply } from "@flowmarkdev/core"
import type { SearchFields, ResultDeclaration } from "@flowmarkdev/core"
export class ResultDeclarationStore extends Context.Service<ResultDeclarationStore>()(
  "@flowmark/db/ResultDeclarationStore",
  {
    make: Effect.gen(function* () {
      const provide = provideDatabase(
        yield* Database,
        yield* DatabaseCancellation,
      )
      return {
        apply: (
          userId: string,
          projectId: string,
          input: DefinitionImportApply,
        ) =>
          provide(
            withOwnerProject(
              userId,
              projectId,
              applyDefinitionImport(userId, projectId, input),
            ),
          ),
        find: (
          userId: string,
          projectId: string,
          workflow: string,
          revision: string,
        ) =>
          provide(
            withActiveProject(
              projectId,
              getResultDeclaration(projectId, workflow, revision),
            ),
          ).pipe(
            Effect.provideService(ProjectReadSubject, { kind: "user", userId }),
          ),
        searchFields: (userId: string, projectId: string, workflow: string) =>
          provide(
            withActiveProject(projectId, getSearchFields(projectId, workflow)),
          ).pipe(
            Effect.provideService(ProjectReadSubject, { kind: "user", userId }),
          ),
        setSearchFields: (
          userId: string,
          projectId: string,
          workflow: string,
          fields: SearchFields,
        ) =>
          provide(
            withOwnerProject(
              userId,
              projectId,
              setSearchFields(projectId, workflow, fields),
            ),
          ),
        list: (userId: string, projectId: string, workflow: string) =>
          provide(
            withActiveProject(
              projectId,
              getResultDeclarations(projectId, workflow),
            ),
          ).pipe(
            Effect.provideService(ProjectReadSubject, { kind: "user", userId }),
          ),
        create: (
          userId: string,
          projectId: string,
          workflow: string,
          declaration: ResultDeclaration,
        ) =>
          provide(
            withOwnerProject(
              userId,
              projectId,
              createResultDeclaration(projectId, workflow, declaration),
            ),
          ),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
