"use client"

import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@flowmark/ui"
import { ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { StatusBadge } from "../shared/dashboard-components"
import { type Run } from "../platform/api-types"
import { formatDuration, formatTimestamp } from "../shared/format"
import { getRunResultHighlights } from "./run-presentation"

function ReportedResult({ run }: { run: Run }) {
  const highlights = getRunResultHighlights(run.result ?? {})
  return (
    <div className="space-y-1">
      <p className="text-xs">
        <span className="text-muted-foreground">Business outcome: </span>
        {run.outcome ?? "Not reported"}
        {run.workflow.startsWith("browser.")
          ? " · Untrusted browser report"
          : ""}
      </p>
      {highlights.length > 0 ? (
        <span className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 [overflow-wrap:anywhere]">
          {highlights.map((item) => (
            <span key={item.key} className="text-xs">
              <span className="text-muted-foreground">{item.label}</span>{" "}
              <span className="font-medium tabular-nums">{item.value}</span>
            </span>
          ))}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">
          {run.result == null ? "Not reported" : "Open run for result"}
        </span>
      )}
    </div>
  )
}

export function RunsTable({
  runs,
  showWorkflow = true,
}: {
  runs: readonly Run[]
  showWorkflow?: boolean
}) {
  if (runs.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-muted-foreground">
        No runs match this view.
      </p>
    )
  }
  return (
    <>
      <ul
        className="divide-y divide-border sm:hidden"
        aria-label="Recorded runs"
      >
        {runs.map((run) => (
          <li key={run.id} className="grid gap-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <Link
                className="min-w-0 break-all text-sm font-medium hover:text-primary"
                href={`/runs/${run.id}`}
              >
                {showWorkflow ? run.workflow : run.externalId.slice(0, 12)}
                <span className="sr-only"> · Open run {run.externalId}</span>
              </Link>
              <StatusBadge status={run.status} />
            </div>
            <ReportedResult run={run} />
            <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
              <time dateTime={run.startedAt}>
                {formatTimestamp(run.startedAt)} UTC
              </time>
              <span className="tabular-nums">
                {formatDuration(run.durationMs)}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              {showWorkflow && <TableHead>Workflow</TableHead>}
              <TableHead>Run</TableHead>
              <TableHead>Run status</TableHead>
              <TableHead>Reported result</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead>Started (UTC)</TableHead>
              <TableHead>
                <span className="sr-only">Open run</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.id}>
                {showWorkflow && (
                  <TableCell>
                    <Link
                      className="font-medium hover:text-primary hover:underline"
                      href={`/workflows/${encodeURIComponent(run.workflow)}`}
                    >
                      {run.workflow}
                    </Link>
                  </TableCell>
                )}
                <TableCell>
                  <Link
                    href={`/runs/${run.id}`}
                    className="font-mono text-xs text-muted-foreground hover:text-primary hover:underline"
                    title={run.externalId}
                  >
                    {run.externalId.slice(0, 12)}
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge status={run.status} />
                </TableCell>
                <TableCell className="min-w-[160px]">
                  <ReportedResult run={run} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums">
                  {formatDuration(run.durationMs)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                  <time dateTime={run.startedAt}>
                    {formatTimestamp(run.startedAt)}
                  </time>
                </TableCell>
                <TableCell>
                  <Button asChild variant="ghost" size="icon">
                    <Link
                      href={`/runs/${run.id}`}
                      aria-label={`Open run ${run.externalId}`}
                    >
                      <ArrowUpRight aria-hidden="true" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
