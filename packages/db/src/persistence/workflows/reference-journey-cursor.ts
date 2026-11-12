import { Effect, Schema } from "effect"
import { InvalidResultQuery } from "../database.js"

const Id = Schema.String.check(Schema.isGUID())
const Instant = Schema.String.check(
  Schema.makeFilter((value) => Number.isFinite(Date.parse(value))),
)
const Scope = Schema.Tuple([
  Schema.String,
  Schema.String,
  Schema.String,
  Schema.String,
  Schema.String,
])
const Cursor = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("candidates"),
    scope: Scope,
    id: Id,
    startedAt: Instant,
  }),
  Schema.Struct({
    kind: Schema.Literal("nodes"),
    scope: Schema.Tuple([
      Schema.String,
      Schema.String,
      Schema.String,
      Schema.String,
      Schema.String,
      Id,
    ]),
    id: Id,
  }),
])
export const invalidJourneySelection = () =>
  new InvalidResultQuery({
    message:
      "Invalid journey selection or continuation. Select the qualified reference and run again.",
  })
export const readJourneyCursor = Effect.fn("readJourneyCursor")(function* (
  value: string | undefined,
) {
  if (value === undefined) {
    return undefined
  }
  return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Cursor))(
    value,
  ).pipe(Effect.mapError(invalidJourneySelection))
})
