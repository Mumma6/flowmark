"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Search } from "lucide-react"
import {
  Badge,
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@flowmark/ui"
import {
  filterRuns,
  formatDuration,
  formatTimestamp,
  groupBy,
  paginate,
  type Run,
  type RunFilters,
} from "./dashboard-data"
import {
  FilterSelect,
  StatusBadge,
  TablePagination,
} from "./dashboard-components"
import { getRunResultHighlights } from "./run-presentation"

export function RunsTable({
  runs,
  showWorkflow = true,
}: {
  runs: readonly Run[]
  showWorkflow?: boolean
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Run</TableHead>
          {showWorkflow && <TableHead>Workflow</TableHead>}
          <TableHead>Status</TableHead>
          <TableHead>Business result</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Started (UTC)</TableHead>
          <TableHead>
            <span className="sr-only">Open run</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
          <TableRow key={run.id}>
            <TableCell>
              <Link
                href={`/runs/${run.id}`}
                className="font-medium hover:text-primary hover:underline"
              >
                <code title={run.externalId}>
                  {run.externalId.slice(0, 12)}
                </code>
              </Link>
            </TableCell>
            {showWorkflow && (
              <TableCell>
                <Link
                  href={`/workflows/${encodeURIComponent(run.workflow)}`}
                  className="font-medium hover:text-primary hover:underline"
                >
                  {run.workflow}
                </Link>
              </TableCell>
            )}
            <TableCell>
              <StatusBadge status={run.status} />
            </TableCell>
            <TableCell>
              <div className="flex min-w-[140px] flex-wrap gap-x-3 gap-y-1">
                {getRunResultHighlights(run.result ?? {}).map((item) => (
                  <span key={item.key}>
                    <strong>{item.label}</strong> {item.value}
                  </span>
                ))}
                {getRunResultHighlights(run.result ?? {}).length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    {run.result == null
                      ? "Not reported"
                      : "Open run for result"}
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {formatDuration(run.durationMs)}
            </TableCell>
            <TableCell className="whitespace-nowrap">
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
        {runs.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={showWorkflow ? 7 : 6}
              className="px-5 py-8 text-center text-sm text-muted-foreground"
            >
              No runs match this view.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}

const defaults: RunFilters = {
  search: "",
  status: "all",
  workflow: "all",
  namespace: "all",
  sort: "recent",
}

export function RunExplorer({
  runs,
  workflow,
  initialSearch = "",
}: {
  runs: readonly Run[]
  workflow?: string
  initialSearch?: string
}) {
  const [filters, setFilters] = useState(() => ({
    ...defaults,
    search: initialSearch,
  }))
  const [grouped, setGrouped] = useState(false)
  const [page, setPage] = useState(1)
  const update = (key: keyof RunFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
  }
  const matching = filterRuns(runs, {
    ...filters,
    workflow: workflow ?? filters.workflow,
  })
  const ordered = grouped
    ? matching.sort((a, b) => a.workflow.localeCompare(b.workflow))
    : matching
  const result = paginate(ordered, page, 15)
  const groups = grouped
    ? groupBy(result.items, (run) => run.workflow)
    : [["Runs", result.items] as const]
  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 p-5">
        <label className="grid min-w-0 flex-[1_1_240px] gap-2 text-xs text-muted-foreground sm:max-w-[360px]">
          <span>Search runs</span>
          <div className="relative">
            <Search
              aria-hidden="true"
              size={16}
              className="pointer-events-none absolute left-2.5 top-2.5"
            />
            <Input
              className="pl-8"
              type="search"
              placeholder="Run ID, workflow or correlation…"
              value={filters.search}
              onChange={(event) => update("search", event.target.value)}
            />
          </div>
        </label>
        {!workflow && (
          <FilterSelect
            label="Workflow"
            value={filters.workflow}
            onChange={(value) => update("workflow", value)}
            options={[
              { value: "all", label: "All workflows" },
              ...[...new Set(runs.map((run) => run.workflow))]
                .sort()
                .map((value) => ({ value, label: value })),
            ]}
          />
        )}
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(value) => update("status", value)}
          options={[
            { value: "all", label: "All statuses" },
            { value: "Completed", label: "Completed" },
            { value: "Failed", label: "Failed" },
            { value: "Running", label: "No final outcome" },
          ]}
        />
        <FilterSelect
          label="Namespace"
          value={filters.namespace}
          onChange={(value) => update("namespace", value)}
          options={[
            { value: "all", label: "All namespaces" },
            { value: "server", label: "Application" },
            { value: "browser", label: "Browser" },
          ]}
        />
        <FilterSelect
          label={grouped ? "Sort within workflow" : "Sort"}
          value={filters.sort}
          onChange={(value) => update("sort", value)}
          options={[
            { value: "recent", label: "Newest first" },
            { value: "duration", label: "Longest first" },
          ]}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
        {!workflow && (
          <Button
            variant={grouped ? "secondary" : "outline"}
            size="sm"
            aria-pressed={grouped}
            onClick={() => {
              setGrouped(!grouped)
              setPage(1)
            }}
          >
            Group by workflow
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setFilters(defaults)
            setPage(1)
          }}
        >
          Clear filters
        </Button>
        <Badge variant="outline">{matching.length} runs</Badge>
      </div>
      <div>
        {groups.map(([name, items]) => (
          <section key={name}>
            {grouped && (
              <div className="flex flex-wrap items-center gap-2.5 border-y border-border bg-secondary/60 px-5 py-3 text-sm font-medium">
                <Link href={`/workflows/${encodeURIComponent(name)}`}>
                  {name}
                </Link>
                <Badge variant="secondary">
                  {matching.filter((run) => run.workflow === name).length}{" "}
                  matches
                </Badge>
              </div>
            )}
            <RunsTable runs={items} showWorkflow={!grouped && !workflow} />
          </section>
        ))}
        {result.total === 0 && (
          <p className="px-5 py-8 text-center text-sm leading-7 text-muted-foreground">
            No runs match these filters. Clear filters to see all available
            runs.
          </p>
        )}
      </div>
      <TablePagination {...result} onPageChange={setPage} />
    </div>
  )
}
