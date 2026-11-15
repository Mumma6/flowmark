import { Context, Effect, Layer } from "effect"
import { Database, DatabaseCancellation, provideDatabase } from "../database.js"
import { createExport } from "./writes/create-export.js"
import { cancelExport } from "./writes/cancel-export.js"
import { readExportPart } from "./queries/read-export-part.js"
import { getLatestExport } from "./queries/get-latest-export.js"
import { checkExport } from "./queries/check-export.js"
export { DataExportRejected } from "./types.js"

export class DataExportStore extends Context.Service<DataExportStore>()(
  "@flowmark/db/DataExportStore",
  {
    make: Effect.gen(function* () {
      const provide = provideDatabase(
        yield* Database,
        yield* DatabaseCancellation,
      )
      return {
        create: (...args: Parameters<typeof createExport>) =>
          provide(createExport(...args)),
        cancel: (...args: Parameters<typeof cancelExport>) =>
          provide(cancelExport(...args)),
        part: (...args: Parameters<typeof readExportPart>) =>
          provide(readExportPart(...args)),
        latest: (...args: Parameters<typeof getLatestExport>) =>
          provide(getLatestExport(...args)),
        check: (...args: Parameters<typeof checkExport>) =>
          provide(checkExport(...args)),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
