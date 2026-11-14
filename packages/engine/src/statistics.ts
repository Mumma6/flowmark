import { Effect, Schema } from "effect"
import { Finite } from "./contracts.js"
import { invoke } from "./boundary.js"
export const percentile = Effect.fn("Engine.percentile")(
  (values: readonly number[], p: number) =>
    invoke(
      "percentile",
      { values, p },
      Schema.Struct({ values: Schema.Array(Finite), p: Finite }),
      Schema.NullOr(Finite),
    ),
)
