import { Badge, Button } from "@flowmark/ui"
import type { ProcessHealth, ProcessHealthRecord } from "@flowmarkdev/core"
import { ArrowLeft, ArrowRight, RotateCw } from "lucide-react"
import type { ReactNode } from "react"
import { formatTimestamp } from "../shared/format"

type Assessment = Extract<ProcessHealth, { status: "assessed" }>

const comparisonMessages = {
  "no-baseline": "No baseline was requested for these dates.",
  "zero-denominator":
    "Comparison unavailable. At least one period has no mature declarations.",
  "thin-history":
    "Comparison unavailable. Each period needs at least five mature declarations.",
  "incompatible-revisions":
    "Comparison unavailable. The periods do not share one definition revision.",
} as const

export function ProcessHealthResult({
  result,
  renderRecord,
  page,
  pending,
  previous,
  next,
  refresh,
}: {
  result: Assessment
  renderRecord: (record: ProcessHealthRecord) => ReactNode
  page: number
  pending: boolean
  previous: () => void
  next: (cursor: string) => void
  refresh: () => void
}) {
  const { execution, businessOutcomes, evidenceQuality, expectations } =
    result.current
  const totalRuns =
    execution.completed + execution.failed + execution.withoutTerminal
  const overdue = expectations.overdue
  const nextCursor = result.evidence.nextCursor
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3">
        <div className="grid min-w-0 gap-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
            <Badge variant={overdue > 0 ? "destructive" : "outline"}>
              {overdue > 0
                ? "Needs attention"
                : expectations.mature > 0
                  ? "Quiet"
                  : "Unmeasured"}
            </Badge>
            <span className="break-all">
              {result.selection.expectationName}
            </span>
          </p>
          <p className="text-xs leading-5 text-muted-foreground">
            {expectations.mature === 0
              ? "No mature declarations in this period."
              : `${overdue.toLocaleString()} overdue of ${expectations.mature.toLocaleString()} mature declarations.`}{" "}
            Observed at {formatTimestamp(result.observedAt)} UTC.
          </p>
          {result.freshness === "refreshed" && (
            <p role="status" className="text-xs text-muted-foreground">
              New evidence changed this assessment. Evidence starts from the
              first page.
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={pending}
        >
          <RotateCw aria-hidden="true" className="size-3.5" />
          Refresh
        </Button>
      </div>

      <div className="grid divide-y divide-border overflow-hidden rounded-lg border border-border xl:grid-cols-3 xl:divide-x xl:divide-y-0">
        <section className="grid content-start gap-2 p-4">
          <h3 className="text-sm font-medium">Execution</h3>
          <p className="text-xs text-muted-foreground">
            {totalRuns.toLocaleString()} recorded runs
          </p>
          <dl className="grid gap-1 text-xs">
            <Metric label="Completed" value={execution.completed} />
            <Metric label="Failed" value={execution.failed} />
            <Metric
              label="Without a terminal report"
              value={execution.withoutTerminal}
            />
          </dl>
        </section>
        <section className="grid min-w-0 content-start gap-2 p-4">
          <h3 className="text-sm font-medium">Reported business outcomes</h3>
          <p className="text-xs text-muted-foreground">
            {businessOutcomes.reported.length === 0
              ? "No business outcomes reported in this period."
              : "Outcome labels reported by the application."}
          </p>
          <dl className="grid gap-1 text-xs">
            {businessOutcomes.reported.slice(0, 3).map(({ outcome, runs }) => (
              <Metric key={outcome} label={outcome} value={runs} />
            ))}
            <Metric
              label="Runs without an outcome"
              value={businessOutcomes.missing}
            />
          </dl>
          {businessOutcomes.reported.length > 3 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-primary">
                Show other outcomes
              </summary>
              <dl className="mt-2 grid gap-1">
                {businessOutcomes.reported.slice(3).map(({ outcome, runs }) => (
                  <Metric key={outcome} label={outcome} value={runs} />
                ))}
              </dl>
            </details>
          )}
        </section>
        <section className="grid min-w-0 content-start gap-2 p-4">
          <h3 className="text-sm font-medium">Evidence quality</h3>
          <p className="text-xs text-muted-foreground">
            Intended declaration coverage is unknown.
          </p>
          <dl className="grid gap-1 text-xs">
            <Metric
              label="Runs without a selected declaration"
              value={evidenceQuality.runsWithoutDeclaration}
            />
            <Metric label="Pending declarations" value={expectations.pending} />
            <Metric
              label="Observed on time (mature)"
              value={expectations.metOnTime}
            />
            <Metric
              label="Observed late (mature)"
              value={expectations.metLate}
            />
          </dl>
          <details className="text-xs">
            <summary className="cursor-pointer text-primary">
              Maturity and exclusions
            </summary>
            <dl className="mt-2 grid gap-1">
              <Metric
                label="Immature declarations"
                value={expectations.immature}
              />
              <Metric
                label="Cancelled declarations"
                value={expectations.cancelled}
              />
              <Metric
                label="Settlements without a declaration"
                value={evidenceQuality.settlementsWithoutDeclaration}
              />
              <Metric
                label="Unavailable projections"
                value={evidenceQuality.unavailableProjections}
              />
              <Metric
                label="Other declaration names"
                value={evidenceQuality.otherExpectationDeclarations}
              />
              <Metric
                label="Observed revisions"
                value={evidenceQuality.revisions.length}
              />
            </dl>
          </details>
        </section>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        {result.comparison.status === "comparable"
          ? `Overdue share vs. baseline: ${(result.comparison.overdueRateDelta * 100).toLocaleString(undefined, { maximumFractionDigits: 1, signDisplay: "exceptZero" })} percentage points.`
          : comparisonMessages[result.comparison.status]}
      </p>
      {result.evidence.total > 0 && (
        <section
          aria-labelledby="overdue-declarations-title"
          className="grid gap-3 rounded-lg border border-border p-4"
        >
          <h3 id="overdue-declarations-title" className="text-sm font-medium">
            Overdue declarations
          </h3>
          <ul className="divide-y divide-border">
            {result.evidence.records.map((record) => (
              <li
                key={JSON.stringify([record.runId, record.expectationId])}
                className="grid min-w-0 gap-1 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                {renderRecord(record)}
                <span className="break-words text-xs leading-5 text-muted-foreground sm:text-right">
                  <span className="block" title={record.runId}>
                    Run {record.runId.slice(0, 8)}
                  </span>
                  Due {record.deadlineAt.replace("T", " ").replace(/Z$/, "")}{" "}
                  UTC
                </span>
              </li>
            ))}
          </ul>
          {(page > 1 || nextCursor) && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                aria-live="polite"
                className="text-xs text-muted-foreground"
              >
                Page {page} · {result.evidence.total.toLocaleString()}{" "}
                declarations
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={page === 1 || pending}
                  onClick={previous}
                >
                  <ArrowLeft aria-hidden="true" className="size-3.5" /> Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!nextCursor || pending}
                  onClick={() => nextCursor && next(nextCursor)}
                >
                  Next <ArrowRight aria-hidden="true" className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-w-0 justify-between gap-2">
      <dt className="break-words text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value.toLocaleString()}</dd>
    </div>
  )
}
