import Link from "next/link"
import {
  Alert,
  AlertDescription,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@flowmark/ui"
import {
  DailyDurationChart,
  DailyVolumeChart,
  FailureCodeChart,
  OperationDurationChart,
} from "./insight-charts"
import {
  durationInRange,
  formatDuration,
  percentChange,
  weekOverWeek,
  type Intelligence,
  type Run,
  type Snapshot,
} from "./dashboard-data"

function signed(value: number | null, suffix = "") {
  if (value == null) {
    return "Not enough data"
  }
  return `${value > 0 ? "+" : ""}${value}${suffix}`
}

function EvidenceLinks({ ids }: { ids: readonly string[] }) {
  if (ids.length === 0) {
    return <span className="text-muted-foreground">No runs</span>
  }
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-1">
      {ids.slice(0, 3).map((id) => (
        <Link
          key={id}
          className="font-mono text-xs hover:text-primary hover:underline"
          href={`/runs/${id}`}
        >
          {id.slice(0, 8)}
        </Link>
      ))}
      {ids.length > 3 && (
        <span className="text-xs text-muted-foreground">
          +{ids.length - 3} more
        </span>
      )}
    </div>
  )
}

export function IntelligencePanel({
  data,
  loading,
  error,
}: {
  data: Intelligence | undefined
  loading: boolean
  error?: string
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          Loading observed changes…
        </CardContent>
      </Card>
    )
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Could not load observed changes: {error}
        </AlertDescription>
      </Alert>
    )
  }
  if (!data) {
    return null
  }
  const durationDelta =
    data.current.medianDurationMs == null ||
    data.previous.medianDurationMs == null
      ? null
      : data.current.medianDurationMs - data.previous.medianDurationMs
  const successDelta =
    data.current.successRate == null || data.previous.successRate == null
      ? null
      : data.current.successRate - data.previous.successRate
  const periodLabel = `${data.current.startedAfter.slice(0, 10)} – ${data.current.startedBefore.slice(0, 10)} vs previous 7 days`
  return (
    <section className="grid min-w-0 gap-4" aria-label="Observed changes">
      <div>
        <h2 className="text-lg font-semibold">Observed changes</h2>
        <p className="text-xs leading-6 text-muted-foreground">
          {periodLabel}. These are application-reported executions, not causal
          explanations.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="p-4 pb-0">
            <CardDescription>Runs</CardDescription>
            <CardTitle className="text-2xl">
              {signed(data.current.totalRuns - data.previous.totalRuns)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 text-xs text-muted-foreground">
            {data.current.totalRuns} current · {data.previous.totalRuns}{" "}
            previous
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-0">
            <CardDescription>Success rate</CardDescription>
            <CardTitle className="text-2xl">
              {signed(successDelta, " pp")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 text-xs text-muted-foreground">
            {data.current.successRate == null
              ? "No finished current runs"
              : `${data.current.successRate}% current · ${data.current.finishedRuns} finished`}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-0">
            <CardDescription>Median duration</CardDescription>
            <CardTitle className="text-2xl">
              {durationDelta == null
                ? "Not enough data"
                : signed(durationDelta, " ms")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 text-xs text-muted-foreground">
            {formatDuration(data.current.medianDurationMs)} current ·{" "}
            {formatDuration(data.previous.medianDurationMs)} previous
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-0">
            <CardDescription>Evidence</CardDescription>
            <CardTitle className="text-2xl">
              {data.current.totalRuns.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 text-xs text-muted-foreground">
            current-window runs included
          </CardContent>
        </Card>
      </div>
      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Operation duration changes</CardTitle>
            <CardDescription>
              Median operation duration compared with the previous window.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data.operations.length === 0 ? (
              <p className="px-6 py-8 text-sm text-muted-foreground">
                No comparable operations in these windows.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operation</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Current runs</TableHead>
                    <TableHead>Evidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.operations.slice(0, 8).map((operation) => (
                    <TableRow key={operation.name}>
                      <TableCell className="font-medium">
                        {operation.name}
                      </TableCell>
                      <TableCell>
                        {operation.durationDeltaMs == null
                          ? "Not comparable"
                          : signed(operation.durationDeltaMs, " ms")}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {operation.currentRunCount}
                      </TableCell>
                      <TableCell>
                        <EvidenceLinks ids={operation.currentRunIds} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Failure-code changes</CardTitle>
            <CardDescription>
              Application-reported terminal failure codes by window.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data.failureCodes.length === 0 ? (
              <p className="px-6 py-8 text-sm text-muted-foreground">
                No failure codes in these windows.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead>Evidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.failureCodes.slice(0, 8).map((failure) => (
                    <TableRow key={failure.code}>
                      <TableCell>
                        <code>{failure.code}</code>
                      </TableCell>
                      <TableCell>{signed(failure.countDelta)}</TableCell>
                      <TableCell className="tabular-nums">
                        {failure.currentCount}
                      </TableCell>
                      <TableCell>
                        <EvidenceLinks ids={failure.currentRunIds} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

function Change({
  current,
  previous,
  invert = false,
}: {
  current: number | null
  previous: number | null
  invert?: boolean
}) {
  const change = percentChange(current, previous)
  if (change == null) {
    return <span className="text-muted-foreground">No prior week</span>
  }
  const improved = invert ? change < 0 : change > 0
  const sign = change > 0 ? "+" : ""
  return (
    <span className={improved ? "text-primary" : "text-destructive"}>
      {sign}
      {change}% vs prior 7 days
    </span>
  )
}

export function WeekOverWeek({
  daily,
  runs,
}: {
  daily: Snapshot["daily"]
  runs: readonly Run[]
}) {
  const { current, previous } = weekOverWeek(daily)
  const last7 = daily.slice(-7)
  const prev7 = daily.slice(-14, -7)
  const currentDuration = durationInRange(
    runs,
    last7[0]?.date ?? "",
    last7.at(-1)?.date ?? "",
  )
  const previousDuration = durationInRange(
    runs,
    prev7[0]?.date ?? "",
    prev7.at(-1)?.date ?? "",
  )
  const cards = [
    {
      label: "Volume",
      value: current.count.toLocaleString(),
      population: "From the 30-day daily series",
      change: <Change current={current.count} previous={previous.count} />,
    },
    {
      label: "Success rate",
      value: current.successRate == null ? "—" : `${current.successRate}%`,
      population: "Among finished runs in the 30-day daily series",
      change: (
        <Change current={current.successRate} previous={previous.successRate} />
      ),
    },
    {
      label: "Median duration",
      value: formatDuration(currentDuration.median),
      population:
        "From the latest-100 run snapshot in that date range — not the same population as volume above",
      change: (
        <Change
          current={currentDuration.median}
          previous={previousDuration.median}
          invert
        />
      ),
    },
    {
      label: "Failed runs",
      value: current.failed.toLocaleString(),
      population: "From the 30-day daily series",
      change: (
        <Change current={current.failed} previous={previous.failed} invert />
      ),
    },
  ] as const
  return (
    <section aria-label="Week over week">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="p-4 pb-0 sm:p-6 sm:pb-0">
              <CardDescription>{card.label} · last 7 days</CardDescription>
              <CardTitle className="text-2xl">{card.value}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 p-4 pt-2 text-xs sm:p-6 sm:pt-2">
              {card.change}
              <p className="leading-5 text-muted-foreground">
                {card.population}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

export function DailyVolumePanel({ daily }: { daily: Snapshot["daily"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily volume</CardTitle>
        <CardDescription>
          Completed and failed runs for the last 30 days · UTC
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DailyVolumeChart daily={daily} />
      </CardContent>
    </Card>
  )
}

export function DailyDurationPanel({ daily }: { daily: Snapshot["daily"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily duration</CardTitle>
        <CardDescription>
          Median and p95 of finished runs · last 30 days · UTC
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DailyDurationChart daily={daily} />
      </CardContent>
    </Card>
  )
}

export function OperationInsightsTable({
  operations,
  empty,
}: {
  operations: Snapshot["operations"]
  empty: string
}) {
  const total = operations.reduce((sum, item) => sum + item.totalDurationMs, 0)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Slowest operations</CardTitle>
        <CardDescription>
          Named work ranked by total recorded time
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {operations.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            {empty}
          </p>
        ) : (
          <>
            <div className="px-6 pb-4">
              <OperationDurationChart operations={operations} />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operation</TableHead>
                  <TableHead>Share</TableHead>
                  <TableHead>Median</TableHead>
                  <TableHead>p95</TableHead>
                  <TableHead>Failed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operations.map((item) => {
                  const share =
                    total === 0 ? 0 : (100 * item.totalDurationMs) / total
                  return (
                    <TableRow key={`${item.workflow}:${item.name}`}>
                      <TableCell>
                        <Link
                          className="font-medium hover:text-primary hover:underline"
                          href={`/workflows/${encodeURIComponent(item.workflow)}`}
                        >
                          {item.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {item.workflow} · {item.count.toLocaleString()}{" "}
                          recorded
                        </p>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {Math.round(share)}%
                      </TableCell>
                      <TableCell>
                        {formatDuration(item.medianDurationMs)}
                      </TableCell>
                      <TableCell>
                        {formatDuration(item.p95DurationMs)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {item.failed}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function FailureCodeTable({
  codes,
  empty,
}: {
  codes: Snapshot["failureCodes"]
  empty: string
}) {
  const total = codes.reduce((sum, item) => sum + item.count, 0)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Failure codes</CardTitle>
        <CardDescription>
          Application-reported <code>fail({"{ code }"})</code> on finished runs
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {codes.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            {empty}
          </p>
        ) : (
          <>
            <div className="px-6 pb-4">
              <FailureCodeChart codes={codes} />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((item) => {
                  const share = total === 0 ? 0 : (100 * item.count) / total
                  return (
                    <TableRow key={`${item.workflow}:${item.code}`}>
                      <TableCell>
                        <code>{item.code}</code>
                      </TableCell>
                      <TableCell>
                        <Link
                          className="hover:text-primary hover:underline"
                          href={`/workflows/${encodeURIComponent(item.workflow)}`}
                        >
                          {item.workflow}
                        </Link>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {item.count}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {Math.round(share)}%
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  )
}
