import {
  ProjectReadSubject,
  ProjectReadDepth,
} from "../project-access/read-subject.js"
import { withActiveProject } from "../data-lifecycle/with-active-project.js"
import { Context, Effect, Layer } from "effect"
import { Database, DatabaseCancellation, provideDatabase } from "../database.js"
import { saveInvestigation } from "./writes/save-investigation.js"
import { deleteInvestigation } from "./writes/delete-investigation.js"
import { getSavedInvestigation } from "./queries/get-saved-investigation.js"
import { listSavedInvestigations } from "./queries/list-saved-investigations.js"
export class InvestigationStore extends Context.Service<InvestigationStore>()(
  "@flowmark/db/InvestigationStore",
  {
    make: Effect.gen(function* () {
      const provide = provideDatabase(
        yield* Database,
        yield* DatabaseCancellation,
      )
      return {
        save: (...args: Parameters<typeof saveInvestigation>) =>
          provide(
            withActiveProject(args[1], saveInvestigation(...args), "current"),
          ).pipe(
            Effect.provideService(ProjectReadDepth, "business"),
            Effect.provideService(ProjectReadSubject, {
              kind: "user",
              userId: args[0],
            }),
          ),
        get: (...args: Parameters<typeof getSavedInvestigation>) =>
          provide(
            withActiveProject(args[1], getSavedInvestigation(...args)),
          ).pipe(
            Effect.provideService(ProjectReadDepth, "business"),
            Effect.provideService(ProjectReadSubject, {
              kind: "user",
              userId: args[0],
            }),
          ),
        list: (...args: Parameters<typeof listSavedInvestigations>) =>
          provide(
            withActiveProject(args[1], listSavedInvestigations(...args)),
          ).pipe(
            Effect.provideService(ProjectReadDepth, "business"),
            Effect.provideService(ProjectReadSubject, {
              kind: "user",
              userId: args[0],
            }),
          ),
        delete: (...args: Parameters<typeof deleteInvestigation>) =>
          provide(
            withActiveProject(args[1], deleteInvestigation(...args), "current"),
          ).pipe(
            Effect.provideService(ProjectReadDepth, "business"),
            Effect.provideService(ProjectReadSubject, {
              kind: "user",
              userId: args[0],
            }),
          ),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
