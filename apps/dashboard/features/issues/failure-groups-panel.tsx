"use client"

import {
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@flowmark/ui"
import Link from "next/link"
import { formatTimestamp } from "../shared/format"
import { failedRunsPath } from "../period/period-presentation"
import { runInvestigationPath } from "../runs/investigation-navigation"

export type FailureGroupRow = {
  readonly workflow: string
  readonly code: string
  readonly currentCount: number
  readonly previousCount: number
  readonly countDelta: number
  readonly lastStartedAt: string | null
  readonly runIds: readonly string[]
}

export function FailureGroupsPanel({
  groups,
  truncated,
  startedAfter,
  startedBefore,
  scopedWorkflow,
  matchingRunsHref = (input) => failedRunsPath(input),
  exampleRunFrom,
}: {
  groups: readonly FailureGroupRow[]
  truncated: boolean
  startedAfter: string
  startedBefore: string
  scopedWorkflow: boolean
  matchingRunsHref?: (input: {
    readonly workflow: string
    readonly code: string
    readonly startedAfter: string
    readonly startedBefore: string
  }) => string
  exampleRunFrom?: string
}) {
  return (
    <section id="failure-groups" className="grid gap-3">
      <div>
        <h2 className="text-base font-semibold">Failure groups</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {scopedWorkflow
            ? "Codes recorded on failed runs of this workflow."
            : "Codes recorded on failed runs, kept separate per workflow."}{" "}
          {truncated
            ? "Showing the 50 groups with the most failures in this window."
            : "Groups with no failures in this window are omitted."}
        </p>
      </div>
      <Card className="min-w-0 overflow-hidden shadow-none">
        <CardContent className="overflow-x-auto p-0">
          {groups.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted-foreground">
              No failed runs started in this window.
            </p>
          ) : (
            <Table className="min-w-[48rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>What happened</TableHead>
                  <TableHead className="text-right">This window</TableHead>
                  <TableHead className="text-right">Previous</TableHead>
                  <TableHead>Last started</TableHead>
                  <TableHead>Evidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => (
                  <TableRow
                    key={`${group.workflow}:${group.code}`}
                    className="hover:bg-muted/40"
                  >
                    <TableCell className="max-w-[280px]">
                      <p className="font-medium">
                        {group.code || "No failure code recorded"}
                      </p>
                      <Link
                        className="mt-1 block text-sm text-muted-foreground hover:text-primary hover:underline"
                        href={`/workflows/${encodeURIComponent(group.workflow)}`}
                      >
                        {group.workflow}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {group.currentCount.toLocaleString()}
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {group.countDelta > 0 ? "+" : ""}
                        {group.countDelta.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {group.previousCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {group.lastStartedAt
                        ? `${formatTimestamp(group.lastStartedAt)} UTC`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <Link
                          className="text-sm font-medium hover:text-primary hover:underline"
                          href={matchingRunsHref({
                            workflow: group.workflow,
                            code: group.code,
                            startedAfter,
                            startedBefore,
                          })}
                        >
                          {group.code ? "Matching runs" : "Failed runs"}
                        </Link>
                        {group.runIds.slice(0, 3).map((id, index) => (
                          <Link
                            key={id}
                            className="text-sm text-muted-foreground hover:text-primary hover:underline"
                            title={id}
                            href={
                              exampleRunFrom
                                ? runInvestigationPath(id, exampleRunFrom)
                                : `/runs/${id}`
                            }
                          >
                            {index === 0
                              ? "Open example run"
                              : `Example ${index + 1}`}
                          </Link>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
