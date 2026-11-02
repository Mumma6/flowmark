import Link from "next/link"
import { CircleAlert } from "lucide-react"
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
  formatDuration,
  type Intelligence,
  type WorkflowSummary,
} from "./dashboard-data"
import { ViewLink } from "./dashboard-components"
import { overviewMetrics, windowLabel } from "./overview-presentation"

export function OverviewMetrics({
  data,
  comparison = "previous 7 days",
  title = "Execution summary · last 7 days",
}: {
  data: Pick<Intelligence, "current" | "previous">
  comparison?: string
  title?: string
}) {
  const metrics = overviewMetrics(data, comparison)
  return (
    <section aria-label={title} className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {title}{" "}
          <span className="block whitespace-nowrap font-normal text-muted-foreground sm:ml-2 sm:inline">
            {windowLabel(data.current)} · UTC
          </span>
        </span>
        <span>
          {data.current.finishedRuns.toLocaleString()} finished ·{" "}
          {(
            data.current.totalRuns - data.current.finishedRuns
          ).toLocaleString()}{" "}
          without a final outcome
        </span>
      </div>
      <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="min-w-0 border-border p-4 odd:border-r [&:nth-child(n+3)]:border-t sm:p-6 lg:border-r lg:last:border-r-0 lg:[&:nth-child(n+3)]:border-t-0"
          >
            <dt className="text-xs font-medium text-muted-foreground">
              {metric.label}
            </dt>
            <dd
              className={`mt-3 text-3xl font-medium tracking-tight tabular-nums ${metric.label === "Failed runs" && data.current.failedRuns > 0 ? "text-destructive" : "text-foreground"}`}
            >
              {metric.value}
            </dd>
            <dd className="mt-2 text-xs leading-5 text-muted-foreground">
              {metric.note}
            </dd>
            {metric.change && (
              <dd className="mt-2 text-xs tabular-nums text-muted-foreground">
                {metric.change}
              </dd>
            )}
          </div>
        ))}
      </dl>
      {data.previous.totalRuns === 0 && (
        <p className="text-xs text-muted-foreground">
          The previous window has no started runs, so these totals are not
          compared.
        </p>
      )}
    </section>
  )
}

export function WorkflowOverview({
  workflows,
}: {
  workflows: readonly WorkflowSummary[]
}) {
  const items = [...workflows]
    .sort(
      (a, b) =>
        (a.successRate ?? 101) - (b.successRate ?? 101) || b.runs - a.runs,
    )
    .slice(0, 5)
  return (
    <Card className="min-w-0 shadow-none">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0 p-5">
        <div>
          <CardTitle className="text-base leading-6">Workflows</CardTitle>
          <CardDescription className="mt-1 text-xs">
            All recorded runs · lowest run completion first
          </CardDescription>
        </div>
        <ViewLink href="/workflows">View all</ViewLink>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Workflow</TableHead>
              <TableHead className="text-right">Runs</TableHead>
              <TableHead
                className="text-right"
                title="Completed among finished runs"
              >
                Run completion
              </TableHead>
              <TableHead className="hidden text-right sm:table-cell">
                p95
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.name}>
                <TableCell className="max-w-[160px] break-words sm:max-w-none">
                  <Link
                    className="font-medium hover:text-primary hover:underline"
                    href={`/workflows/${encodeURIComponent(item.name)}`}
                  >
                    {item.name}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {item.runs.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {item.successRate == null
                    ? "No finished runs"
                    : `${item.successRate}%`}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">
                  {formatDuration(item.p95DurationMs)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {items.length === 0 && (
          <p className="p-5 text-sm text-muted-foreground">
            No workflows recorded yet.
          </p>
        )}
        <p className="border-t border-border px-5 py-3 text-xs leading-5 text-muted-foreground">
          Run completion includes finished runs only. Business results may still
          need attention.
        </p>
      </CardContent>
    </Card>
  )
}

export function AttentionSummary({
  failedRuns,
}: {
  failedRuns: number | null
}) {
  return (
    <Card className="min-w-0 shadow-none">
      <CardHeader className="p-5">
        <div className="flex items-center gap-2">
          <CircleAlert
            size={16}
            className="text-muted-foreground"
            aria-hidden="true"
          />
          <CardTitle className="text-base leading-6">
            What needs attention
          </CardTitle>
        </div>
        <CardDescription className="text-xs">
          Explicit technical failures · runs started in the last 7 days
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 p-5 pt-0">
        <p className="text-3xl font-medium tabular-nums">
          {failedRuns == null ? "—" : failedRuns.toLocaleString()}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          Failure groups, longer operations and the runs behind them are on
          Issues. Trends and reported outcomes are on Insights.
        </p>
        <div className="flex flex-wrap gap-2">
          <ViewLink href="/issues">Investigate issues</ViewLink>
          <ViewLink href="/insights">View trends</ViewLink>
        </div>
      </CardContent>
    </Card>
  )
}
