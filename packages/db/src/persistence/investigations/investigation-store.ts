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
          provide(saveInvestigation(...args)),
        get: (...args: Parameters<typeof getSavedInvestigation>) =>
          provide(getSavedInvestigation(...args)),
        list: (...args: Parameters<typeof listSavedInvestigations>) =>
          provide(listSavedInvestigations(...args)),
        delete: (...args: Parameters<typeof deleteInvestigation>) =>
          provide(deleteInvestigation(...args)),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
