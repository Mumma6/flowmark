import type { ExpectationRecord } from "@flowmarkdev/core"
import { Match } from "effect"

export const expectationLabel = (
  record: Pick<ExpectationRecord, "state" | "cancelledAfterDeadline">,
) => {
  if (record.cancelledAfterDeadline) {
    return "Cancelled after deadline"
  }
  return Match.value(record.state).pipe(
    Match.when("pending", () => "Pending confirmation"),
    Match.when("overdue", () => "Overdue — no resolution observed"),
    Match.when("met-on-time", () => "Observed on time"),
    Match.when("met-late", () => "Observed late"),
    Match.when("cancelled", () => "Cancelled"),
    Match.when(
      "unmatched",
      () => "Settlement recorded; declaration unavailable",
    ),
    Match.exhaustive,
  )
}
