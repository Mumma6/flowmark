"use client"

import { ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import type { Run } from "../platform/api-types"
import { StatusBadge } from "../shared/dashboard-components"
import { formatDuration, formatTimestamp } from "../shared/format"
import { runInvestigationPath } from "../runs/investigation-navigation"
import { getRunResultHighlights } from "../runs/run-presentation"

export function ExploreRunList({ runs }: { runs: readonly Run[] }) {
  const pathname = usePathname()
  const params = useSearchParams()
  const from = `${pathname}${params.size ? `?${params}` : ""}`
  return (
    <ul aria-label="Execution evidence" className="divide-y divide-border">
      {runs.map((run) => {
        const highlights = getRunResultHighlights(run.result ?? {}).slice(0, 2)
        return (
          <li key={run.id}>
            <Link
              href={runInvestigationPath(run.id, from)}
              className="group grid gap-3 px-5 py-5 transition-colors hover:bg-primary/[0.035] focus-visible:bg-primary/[0.035] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:px-6"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-start justify-between gap-3 sm:justify-start">
                  <p className="min-w-0 break-words font-mono text-[13px] font-medium tracking-tight group-hover:text-primary">
                    {run.workflow}
                  </p>
                  <span className="shrink-0">
                    <StatusBadge status={run.status} />
                  </span>
                </div>
                <div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span
                    className="max-w-full truncate font-mono"
                    title={run.externalId}
                  >
                    {run.externalId}
                  </span>
                  <span>
                    Outcome:{" "}
                    <span className="text-foreground/80">
                      {run.outcome ?? "Not reported"}
                    </span>
                  </span>
                  {run.workflow.startsWith("browser.") ? (
                    <span className="text-warning">
                      Untrusted browser report
                    </span>
                  ) : null}
                </div>
                {highlights.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                    {highlights.map((item) => (
                      <span key={item.key} className="break-all">
                        <span className="text-muted-foreground">
                          {item.label}
                        </span>{" "}
                        <span className="tabular-nums">{item.value}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-5 text-[10px] text-muted-foreground sm:justify-end">
                <div className="flex items-center gap-4 sm:grid sm:gap-1.5 sm:text-right">
                  <span className="font-mono tabular-nums text-foreground/80">
                    {formatDuration(run.durationMs)}
                  </span>
                  <time dateTime={run.startedAt}>
                    {formatTimestamp(run.startedAt)} UTC
                  </time>
                </div>
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary"
                />
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
