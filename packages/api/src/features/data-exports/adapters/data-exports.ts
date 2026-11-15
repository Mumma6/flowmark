import {
  DataExportStore,
  type DataExportRejected,
  type DatabaseError,
} from "@flowmark/db/persistence"
import { Effect, Layer, Match } from "effect"
import { InvalidInput, Unauthorized } from "../../../errors.js"
import { toPersistenceError } from "../../../adapters/persistence-error.js"
import { DataExports } from "../ports/data-exports.js"

const translate = <A, R>(
  effect: Effect.Effect<A, DataExportRejected | DatabaseError, R>,
) =>
  effect.pipe(
    Effect.mapError((error) =>
      Match.value(error).pipe(
        Match.tag("DatabaseError", toPersistenceError),
        Match.tag("DataExportRejected", ({ reason }) =>
          reason === "Unavailable"
            ? new Unauthorized({ permission: "read" })
            : new InvalidInput({
                cause: Match.value(reason).pipe(
                  Match.when(
                    "TooManyRequests",
                    () =>
                      "Export request limit reached. Wait for existing requests to expire.",
                  ),
                  Match.when(
                    "OversizedRecord",
                    () =>
                      "A record exceeds the safe export limit. This export is incomplete.",
                  ),
                  Match.when(
                    "InvalidCursor",
                    () =>
                      "This export part is no longer available. Retry the last part or start again.",
                  ),
                  Match.exhaustive,
                ),
              }),
        ),
        Match.exhaustive,
      ),
    ),
  )
export const DataExportsLive = Layer.effect(
  DataExports,
  Effect.gen(function* () {
    const store = yield* DataExportStore
    return DataExports.of({
      latest: (...args) => translate(store.latest(...args)),
      check: (...args) => translate(store.check(...args)),
      create: (...args) => translate(store.create(...args)),
      cancel: (...args) => translate(store.cancel(...args)),
      part: (...args) => translate(store.part(...args)),
    })
  }),
)
