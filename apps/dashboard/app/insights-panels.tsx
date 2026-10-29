import Link from "next/link"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
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
  formatDuration,
  type Intelligence,
  type Snapshot,
} from "./dashboard-data"
import { windowLabel } from "./overview-presentation"

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
  const periodLabel = windowLabel(data.current)
  return (
    <section className="grid min-w-0 gap-3" aria-label="Observed changes">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Observed changes</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {periodLabel} · UTC · compared with previous 7 days
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {data.current.totalRuns} current · {data.previous.totalRuns} previous
          runs
        </span>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        {data.previous.totalRuns === 0 ? (
          "No previous-period baseline. Current evidence is available below."
        ) : (
          <>
            Median duration:{" "}
            {durationDelta == null
              ? "not comparable"
              : signed(Math.round(durationDelta), " ms")}
            . Run completion:{" "}
            {successDelta == null
              ? "not comparable"
              : signed(Math.round(successDelta * 10) / 10, " pp")}
            . Describes recorded change, not its cause.
          </>
        )}
      </p>
      <Accordion className="rounded-xl border border-border bg-card px-5">
        <AccordionItem value="change-evidence">
          <AccordionTrigger>
            Inspect operations & failure evidence
          </AccordionTrigger>
          <AccordionContent className="max-w-none">
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  )
}

export function DailyVolumePanel({
  daily,
  scope = "Last 30 days · UTC",
}: {
  daily: Snapshot["daily"]
  scope?: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Daily volume</CardTitle>
        <CardDescription>Completed and failed runs · {scope}</CardDescription>
      </CardHeader>
      <CardContent>
        <DailyVolumeChart daily={daily} />
        <DailyData daily={daily} />
      </CardContent>
    </Card>
  )
}

export function DailyDurationPanel({
  daily,
  scope = "Last 30 days · UTC",
}: {
  daily: Snapshot["daily"]
  scope?: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Daily duration</CardTitle>
        <CardDescription>
          Median and p95 of measured finished runs · {scope}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DailyDurationChart daily={daily} />
        <DailyData daily={daily} duration />
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

function DailyData({
  daily,
  duration = false,
}: {
  daily: Snapshot["daily"]
  duration?: boolean
}) {
  return (
    <Accordion className="mt-3 border-t border-border">
      <AccordionItem value="daily-values">
        <AccordionTrigger className="min-h-10 py-2 text-xs sm:text-xs">
          View daily values
        </AccordionTrigger>
        <AccordionContent className="max-w-none">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date (UTC)</TableHead>
                <TableHead>
                  {duration ? "Median duration" : "Completed runs"}
                </TableHead>
                <TableHead>
                  {duration ? "p95 duration" : "Failed runs"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daily.map((day) => (
                <TableRow key={day.date}>
                  <TableCell className="whitespace-nowrap">
                    {day.date}
                  </TableCell>
                  <TableCell>
                    {duration
                      ? formatDuration(day.medianDurationMs)
                      : day.completed}
                  </TableCell>
                  <TableCell>
                    {duration ? formatDuration(day.p95DurationMs) : day.failed}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
