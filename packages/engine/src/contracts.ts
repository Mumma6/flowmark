import { Schema } from "effect"
export const Finite = Schema.Number.check(Schema.isFinite())
export const Count = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
)
