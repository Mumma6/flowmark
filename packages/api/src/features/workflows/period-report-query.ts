import { BusinessTimestampSchema } from "@flowmarkdev/core"
import { Schema } from "effect"

const maxWindowMs = 31 * 86_400_000

export const PeriodReportQuerySchema = Schema.Struct({
  workflow: Schema.optional(
    Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200)),
  ),
  currentStartedAfter: BusinessTimestampSchema,
  currentStartedBefore: BusinessTimestampSchema,
  previousStartedAfter: BusinessTimestampSchema,
  previousStartedBefore: BusinessTimestampSchema,
}).check(
  Schema.makeFilter((query) => {
    const current =
      Date.parse(query.currentStartedBefore) -
      Date.parse(query.currentStartedAfter)
    const previous =
      Date.parse(query.previousStartedBefore) -
      Date.parse(query.previousStartedAfter)
    return (
      current > 0 &&
      previous > 0 &&
      current <= maxWindowMs &&
      previous <= maxWindowMs &&
      Date.parse(query.previousStartedBefore) <=
        Date.parse(query.currentStartedAfter)
    )
  }),
)

export const periodReportWindowMessage =
  "Comparison windows must be canonical UTC timestamps, each at most 31 days, with the previous window ending at or before the current window starts."
