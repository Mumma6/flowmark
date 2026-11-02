"use client"

import type { AppRouter } from "@flowmark/server/trpc"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@flowmark/ui"
import type { inferRouterOutputs } from "@trpc/server"
import Link from "next/link"
import { useState } from "react"
import {
  StatusBadge,
  TablePagination,
} from "../../components/dashboard-components"
import { paginate } from "../../lib/collections"
import { formatTimestamp } from "../../lib/format"

type RunRelationships = inferRouterOutputs<AppRouter>["run"]["related"]
type RelatedRun = RunRelationships["related"][number]

export function RelatedRunsTable({
  title,
  runs,
  empty,
}: {
  title: string
  runs: readonly RelatedRun[]
  empty: string
}) {
  const [page, setPage] = useState(1)
  const result = paginate(runs, page, 10)
  return (
    <section>
      <h3 className="mb-3 mt-4 text-sm font-semibold">{title}</h3>
      {runs.length > 0 ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow</TableHead>
                <TableHead>Run</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started (UTC)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>
                    <Link
                      className="font-medium hover:text-primary hover:underline"
                      href={`/workflows/${encodeURIComponent(run.workflow)}`}
                    >
                      {run.workflow}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      className="font-medium hover:text-primary hover:underline"
                      href={`/runs/${run.id}`}
                    >
                      <code>{run.externalId}</code>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={run.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatTimestamp(run.startedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination {...result} onPageChange={setPage} />
        </>
      ) : (
        <p className="py-3 text-xs leading-6 text-muted-foreground">{empty}</p>
      )}
    </section>
  )
}
