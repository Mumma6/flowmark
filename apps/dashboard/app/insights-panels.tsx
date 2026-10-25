import Link from "next/link"
import {
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
  type Run,
  type Snapshot,
} from "./dashboard-data"

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
      change: (
        <Change current={current.count} previous={previous.count} />
      ),
    },
    {
      label: "Success rate",
      value: current.successRate == null ? "—" : `${current.successRate}%`,
      change: (
        <Change
          current={current.successRate}
          previous={previous.successRate}
        />
      ),
    },
    {
      label: "Median duration",
      value: formatDuration(currentDuration.median),
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
      change: (
        <Change
          current={current.failed}
          previous={previous.failed}
          invert
        />
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
            <CardContent className="p-4 pt-2 text-xs sm:p-6 sm:pt-2">
              {card.change}
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
                        {item.workflow} · {item.count.toLocaleString()} recorded
                      </p>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {Math.round(share)}%
                    </TableCell>
                    <TableCell>{formatDuration(item.medianDurationMs)}</TableCell>
                    <TableCell>{formatDuration(item.p95DurationMs)}</TableCell>
                    <TableCell className="tabular-nums">{item.failed}</TableCell>
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
                    <TableCell className="tabular-nums">{item.count}</TableCell>
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
