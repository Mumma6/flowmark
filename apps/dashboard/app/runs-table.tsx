"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
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
import { formatDuration, formatTimestamp, type Run } from "./dashboard-data"
import { FilterSelect, StatusBadge } from "./dashboard-components"
import { getRunResultHighlights } from "./run-presentation"
import { useTRPC } from "../lib/trpc"
import { useProject } from "./project-context"

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

type ExplorerFilters = {
  search: string
  status: string
  workflow: string
  namespace: string
  failCode: string
  environment: string
  release: string
  startedAfter: string
  startedBefore: string
}

const defaults: ExplorerFilters = {
  search: "",
  status: "all",
  workflow: "all",
  namespace: "all",
  failCode: "",
  environment: "",
  release: "",
  startedAfter: "",
  startedBefore: "",
}

export function RunExplorer({
  workflow,
  workflowNames = [],
  initialSearch = "",
}: {
  workflow?: string
  workflowNames?: readonly string[]
  initialSearch?: string
}) {
  const trpc = useTRPC()
  const { current } = useProject()
  const [filters, setFilters] = useState<ExplorerFilters>(() => ({
    ...defaults,
    search: initialSearch,
  }))
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null])
  const pageIndex = cursorStack.length - 1
  const cursor = cursorStack[pageIndex] ?? null
  const update = (key: keyof ExplorerFilters, value: string) => {
    setFilters((currentFilters) => ({ ...currentFilters, [key]: value }))
    setCursorStack([null])
  }
  const queryInput = useMemo(
    () => ({
      workflow:
        workflow ?? (filters.workflow !== "all" ? filters.workflow : undefined),
      status:
        filters.status === "all"
          ? undefined
          : (filters.status as "Completed" | "Failed" | "Running"),
      search: filters.search.trim() || undefined,
      failCode: filters.failCode.trim() || undefined,
      environment: filters.environment.trim() || undefined,
      release: filters.release.trim() || undefined,
      namespace:
        filters.namespace === "browser"
          ? ("browser" as const)
          : filters.namespace === "server"
            ? ("application" as const)
            : undefined,
      startedAfter: filters.startedAfter
        ? `${filters.startedAfter}T00:00:00.000Z`
        : undefined,
      startedBefore: filters.startedBefore
        ? `${filters.startedBefore}T23:59:59.999Z`
        : undefined,
      cursor: cursor ?? undefined,
      limit: 25,
    }),
    [workflow, filters, cursor],
  )
  const list = useQuery({
    ...trpc.run.list.queryOptions(queryInput),
    enabled: Boolean(current),
  })
  const runs = list.data?.runs ?? []
  const total = list.data?.total ?? 0
  const nextCursor = list.data?.nextCursor ?? null
  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 border-b border-border/60 bg-white/[0.015] p-5">
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
              placeholder="Run ID, workflow, fail code, correlation…"
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
              ...workflowNames.map((value) => ({ value, label: value })),
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
        <label className="grid min-w-0 flex-[1_1_140px] gap-2 text-xs text-muted-foreground sm:max-w-[200px]">
          <span>Fail code</span>
          <Input
            value={filters.failCode}
            placeholder="e.g. LOAD_FAILED"
            onChange={(event) => update("failCode", event.target.value)}
          />
        </label>
        <label className="grid min-w-0 flex-[1_1_140px] gap-2 text-xs text-muted-foreground sm:max-w-[180px]">
          <span>Environment</span>
          <Input
            value={filters.environment}
            placeholder="production"
            onChange={(event) => update("environment", event.target.value)}
          />
        </label>
        <label className="grid min-w-0 flex-[1_1_140px] gap-2 text-xs text-muted-foreground sm:max-w-[180px]">
          <span>Release</span>
          <Input
            value={filters.release}
            placeholder="2026.10.2"
            onChange={(event) => update("release", event.target.value)}
          />
        </label>
        <label className="grid min-w-0 flex-[1_1_140px] gap-2 text-xs text-muted-foreground sm:max-w-[160px]">
          <span>Started after</span>
          <Input
            type="date"
            value={filters.startedAfter}
            onChange={(event) => update("startedAfter", event.target.value)}
          />
        </label>
        <label className="grid min-w-0 flex-[1_1_140px] gap-2 text-xs text-muted-foreground sm:max-w-[160px]">
          <span>Started before</span>
          <Input
            type="date"
            value={filters.startedBefore}
            onChange={(event) => update("startedBefore", event.target.value)}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setFilters({ ...defaults, search: "" })
            setCursorStack([null])
          }}
        >
          Clear filters
        </Button>
        <Badge variant="outline">{total.toLocaleString()} matching runs</Badge>
        <p className="text-xs text-muted-foreground">
          Server-side history · page {pageIndex + 1}
        </p>
      </div>
      {list.isPending ? (
        <p role="status" className="px-5 py-8 text-sm text-muted-foreground">
          Loading runs…
        </p>
      ) : list.error ? (
        <p className="px-5 py-8 text-sm text-destructive">
          Could not load runs: {list.error.message}
        </p>
      ) : (
        <RunsTable runs={runs} showWorkflow={!workflow} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
        <p className="text-xs text-muted-foreground">
          Showing {runs.length} of {total.toLocaleString()}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pageIndex === 0 || list.isFetching}
            onClick={() =>
              setCursorStack((stack) =>
                stack.length > 1 ? stack.slice(0, -1) : stack,
              )
            }
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!nextCursor || list.isFetching}
            onClick={() => setCursorStack((stack) => [...stack, nextCursor])}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
