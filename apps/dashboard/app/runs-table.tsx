"use client"

import { useSearchParams, usePathname } from "next/navigation"
import { useMemo, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowUpRight, Search } from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
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
import { DataState, FilterSelect, StatusBadge } from "./dashboard-components"
import { getRunResultHighlights } from "./run-presentation"
import { useTRPC } from "../lib/trpc"
import { useProject } from "./project-context"

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

type ExplorerFilters = {
  businessKey: string
  businessValue: string
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
  businessKey: "",
  businessValue: "",
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
}: {
  workflow?: string
  workflowNames?: readonly string[]
  initialSearch?: string
}) {
  const trpc = useTRPC()
  const { current } = useProject()
  const params = useSearchParams()
  const pathname = usePathname()
  const signature = params.toString()
  const filters = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(defaults).map(([key, fallback]) => [
          key,
          params.get(key) ?? fallback,
        ]),
      ) as ExplorerFilters,
    [params],
  )
  const setFilters = (next: ExplorerFilters) => {
    const url = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value === defaults[key as keyof ExplorerFilters]) {
        url.delete(key)
      } else {
        url.set(key, value)
      }
    }
    window.history.replaceState(
      null,
      "",
      `${pathname}${url.size ? `?${url}` : ""}`,
    )
  }
  const [pagination, setPagination] = useState<{
    signature: string
    stack: (string | null)[]
  }>({ signature: "", stack: [null] })
  const cursorStack =
    pagination.signature === signature ? pagination.stack : [null]
  const setCursorStack = (
    next: (string | null)[] | ((stack: (string | null)[]) => (string | null)[]),
  ) =>
    setPagination({
      signature,
      stack: typeof next === "function" ? next(cursorStack) : next,
    })
  const pageIndex = cursorStack.length - 1
  const cursor = cursorStack[pageIndex] ?? null
  const update = (key: keyof ExplorerFilters, value: string) => {
    setFilters({
      ...filters,
      [key]: value,
      ...(key === "workflow" ? { businessKey: "", businessValue: "" } : {}),
    })
    setCursorStack([null])
  }
  const selectedWorkflow =
    workflow ?? (filters.workflow !== "all" ? filters.workflow : "")
  const searchFields = useQuery(
    trpc.resultDeclarations.searchFields.queryOptions(
      { projectId: current?.id ?? "", workflow: selectedWorkflow },
      { enabled: Boolean(current && selectedWorkflow) },
    ),
  )
  const selectedField = searchFields.data?.find(
    (field) => field.key === filters.businessKey,
  )
  const queryInput = useMemo(
    () => ({
      workflow:
        workflow ?? (filters.workflow !== "all" ? filters.workflow : undefined),
      businessKey:
        selectedWorkflow && filters.businessKey && filters.businessValue
          ? filters.businessKey
          : undefined,
      businessValue:
        selectedWorkflow && filters.businessKey && filters.businessValue
          ? filters.businessValue
          : undefined,
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
    [workflow, filters, cursor, selectedWorkflow],
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
      <div className="flex flex-wrap items-end gap-3 border-b border-border/60 bg-muted/20 p-5">
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
      <div className="grid gap-3 border-b border-border p-5 sm:grid-cols-2">
        <p className="text-sm text-muted-foreground sm:col-span-2">
          Business reference or category · exact current-context match. Choose a
          workflow first. Browser context is untrusted.
        </p>
        {selectedWorkflow && searchFields.isPending && (
          <p role="status">Loading searchable fields…</p>
        )}
        {selectedWorkflow && searchFields.error && (
          <p role="alert">
            Could not load searchable fields.{" "}
            <Button
              variant="outline"
              onClick={() => void searchFields.refetch()}
            >
              Retry
            </Button>
          </p>
        )}
        {selectedWorkflow && searchFields.data?.length === 0 && (
          <p className="text-sm">
            No business fields enabled. Configure them on the workflow page.
          </p>
        )}
        <FilterSelect
          label="Business field"
          value={filters.businessKey || "__no_filter__"}
          onChange={(value) => {
            setFilters({
              ...filters,
              businessKey: value === "__no_filter__" ? "" : value,
              businessValue: "",
            })
            setCursorStack([null])
          }}
          options={[
            { value: "__no_filter__", label: "No business filter" },
            ...(searchFields.data ?? []).map((field) => ({
              value: field.key,
              label: `${field.key} · ${field.role === "lookup" ? "Reference" : "Category"}`,
            })),
          ]}
        />
        {selectedField?.role === "dimension" ? (
          <FilterSelect
            label="Exact business value"
            value={
              filters.businessValue
                ? `value:${filters.businessValue}`
                : "__unset__"
            }
            onChange={(value) =>
              update(
                "businessValue",
                value === "__unset__" ? "" : value.slice(6),
              )
            }
            options={[
              { value: "__unset__", label: "Choose category" },
              ...selectedField.values.map((value) => ({
                value: `value:${value}`,
                label: value,
              })),
            ]}
          />
        ) : (
          <label className="grid gap-2 text-xs text-muted-foreground">
            Exact business value
            <Input
              disabled={!selectedWorkflow || !filters.businessKey}
              value={filters.businessValue}
              maxLength={256}
              onChange={(event) => update("businessValue", event.target.value)}
              placeholder="Exact, case-sensitive reference"
            />
          </label>
        )}
        {filters.businessKey && filters.businessValue && (
          <p className="break-words text-sm sm:col-span-2">
            Matching current {filters.businessKey}:{" "}
            <strong>{filters.businessValue}</strong>. Initial properties plus
            accepted amendments; step properties are excluded.
          </p>
        )}
      </div>
      <Accordion className="border-b border-border px-5">
        <AccordionItem value="advanced-filters">
          <AccordionTrigger className="min-h-11 py-3 text-xs sm:text-xs">
            More filters{" "}
            <span className="mr-auto text-muted-foreground">
              {[
                filters.namespace !== "all",
                Boolean(filters.failCode),
                Boolean(filters.environment),
                Boolean(filters.release),
              ].filter(Boolean).length || ""}
            </span>
          </AccordionTrigger>
          <AccordionContent className="max-w-none">
            <div className="flex flex-wrap items-end gap-3">
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
                  onChange={(event) =>
                    update("environment", event.target.value)
                  }
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
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <div className="flex flex-wrap items-center gap-2 px-5 py-3">
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
        <Badge variant="outline">
          {list.isPending
            ? "Loading matches…"
            : list.error
              ? "Matches unavailable"
              : `${total.toLocaleString()} matching runs`}
        </Badge>
        <p className="text-xs text-muted-foreground">
          Full recorded history · page {pageIndex + 1}
        </p>
      </div>
      {Object.entries(filters).some(
        ([key, value]) => value !== defaults[key as keyof ExplorerFilters],
      ) && (
        <div
          className="flex flex-wrap gap-2 px-5 pb-3"
          aria-label="Applied filters"
        >
          {Object.entries(filters)
            .filter(
              ([key, value]) =>
                value !== defaults[key as keyof ExplorerFilters],
            )
            .map(([key, value]) => (
              <Badge key={key} variant="secondary">
                {
                  (
                    {
                      businessKey: "Business field",
                      businessValue: "Business value",
                      search: "Search",
                      workflow: "Workflow",
                      status: "Status",
                      namespace: "Namespace",
                      failCode: "Failure code",
                      environment: "Environment",
                      release: "Release",
                      startedAfter: "From",
                      startedBefore: "Through",
                    } as const
                  )[key as keyof ExplorerFilters]
                }
                : {value === "Running" ? "No final outcome" : value}
              </Badge>
            ))}
        </div>
      )}
      <div className="px-5">
        <DataState
          pending={list.isPending}
          error={list.error}
          retry={() => void list.refetch()}
        />
      </div>
      {!list.isPending && !list.error && (
        <RunsTable runs={runs} showWorkflow={!workflow} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
        <p className="text-xs text-muted-foreground">
          {list.isPending
            ? "Loading history…"
            : list.error
              ? "History unavailable"
              : `Showing ${runs.length} of ${total.toLocaleString()}`}
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
