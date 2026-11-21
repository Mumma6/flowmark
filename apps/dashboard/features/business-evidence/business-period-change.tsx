import type { BusinessInsights } from "@flowmarkdev/core"
import { Array, Option } from "effect"

const signed = { signDisplay: "exceptZero" } as const

function reportedCount(total: string | null) {
  const integer = total?.match(/^(\d+)(?:\.0+)?$/)?.[1]
  return integer === undefined ? null : BigInt(integer)
}

export function BusinessPeriodChange({ report }: { report: BusinessInsights }) {
  const { query, field, windows } = report
  const current = Option.getOrUndefined(
    Array.findFirst(windows, (window) => window.scope === "current"),
  )
  const baseline = Option.getOrUndefined(
    Array.findFirst(windows, (window) => window.scope === "previous"),
  )
  if (
    !current ||
    !baseline ||
    baseline.totalRuns === 0 ||
    current.totalRuns === 0
  ) {
    return (
      <p className="text-sm text-muted-foreground">
        Change unavailable. Both periods need recorded runs.
      </p>
    )
  }
  const currentWidth =
    Date.parse(query.currentStartedBefore) -
    Date.parse(query.currentStartedAfter)
  const baselineWidth =
    Date.parse(query.previousStartedBefore) -
    Date.parse(query.previousStartedAfter)
  if (
    baselineWidth !== currentWidth ||
    Date.parse(query.previousStartedBefore) >
      Date.parse(query.currentStartedAfter)
  ) {
    return (
      <p className="text-sm text-muted-foreground">
        Change unavailable. Compare equal-length periods without overlap.
      </p>
    )
  }
  const currentTotal = reportedCount(current.total)
  const baselineTotal = reportedCount(baseline.total)
  const countChange =
    currentTotal !== null && baselineTotal !== null
      ? currentTotal - baselineTotal
      : null
  const failureChange =
    current.finishedRuns > 0 && baseline.finishedRuns > 0
      ? (current.failedRuns / current.finishedRuns -
          baseline.failedRuns / baseline.finishedRuns) *
        100
      : null

  return (
    <div className="grid gap-2 rounded-lg border border-border p-4 text-sm">
      <h3 className="font-medium">Change from the previous period</h3>
      <dl className="grid gap-1">
        {field.kind === "count" && (
          <div>
            <dt className="font-medium">Reported total change</dt>
            <dd>
              {countChange === null
                ? "Unavailable. Both periods need a reported total."
                : [
                    `${countChange > 0n ? "+" : ""}${countChange.toLocaleString()}`,
                    field.unit,
                  ]
                    .filter(Boolean)
                    .join(" ")}
            </dd>
          </div>
        )}
        <div>
          <dt className="font-medium">Share of terminal runs that failed</dt>
          <dd>
            {failureChange === null
              ? "Unavailable. Both periods need terminal runs."
              : `${failureChange.toLocaleString(undefined, { ...signed, maximumFractionDigits: 1 })} percentage points`}
          </dd>
        </div>
      </dl>
      <p className="text-muted-foreground">
        Changes reflect recorded runs. Check run volume and reported-result
        coverage in each period before interpreting them.
      </p>
    </div>
  )
}
