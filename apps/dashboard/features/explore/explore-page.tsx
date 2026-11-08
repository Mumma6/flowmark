"use client"

import {
  Badge,
  Button,
  Input,
  Skeleton,
  StudioWorkspace,
  StudioProcessPane,
} from "@flowmark/ui"
import { Array as EffectArray } from "effect"
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CircleDot,
  RotateCw,
  Search,
  SlidersHorizontal,
  Workflow,
  X,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { readInspectorRunId } from "../runs/investigation-navigation"
import { RunInspector } from "../runs/run-inspector"
import { publicConfig } from "../platform/config-public"
import { useProject } from "../projects/project-context"
import { useSnapshot } from "../projects/queries"
import {
  explorerDefaults,
  explorerFilterLabels,
  type ExplorerFilters,
} from "../runs/explorer-filters"
import { useRunExplorer } from "../runs/use-run-explorer"
import { DataState, FilterSelect } from "../shared/dashboard-components"
import { ExploreAnalyticsContext } from "./explore-analytics-context"
import { exploreAnalyticsQueryKey } from "./explore-analytics-query"
import { ExploreRunList } from "./explore-run-list"

const executionStates = [
  { value: "all", label: "All" },
  { value: "Completed", label: "Completed" },
  { value: "Failed", label: "Failed" },
  { value: "Running", label: "No final outcome" },
] as const

function ExploreWorkspace() {
  const params = useSearchParams()
  const pathname = usePathname()
  const snapshot = useSnapshot()
  const explorer = useRunExplorer()
  const {
    filters,
    update,
    list,
    runs,
    total,
    nextCursor,
    pageIndex,
    setFilters,
    setCursorStack,
  } = explorer
  const workflows = snapshot.data?.workflows ?? []
  const activeFilters = EffectArray.filter(
    EffectArray.fromIterable(Object.entries(filters)),
    ([key, value]) => value !== explorerDefaults[key as keyof ExplorerFilters],
  )
  const historyParams = new URLSearchParams(params.toString())
  historyParams.delete(exploreAnalyticsQueryKey)
  historyParams.set("view", "runs")
  const historyHref = `/runs?${historyParams}`
  const clearFilters = () => {
    setFilters({ ...explorerDefaults }, "push")
    setCursorStack([null])
  }
  const exploreFrom = `${pathname}${params.size ? `?${params}` : ""}`

  return (
    <div id="explore-workspace" className="grid gap-7">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <span
              className="size-1.5 rounded-full bg-highlight"
              aria-hidden="true"
            />
            Studio / Explore
          </p>
          <h1 className="text-3xl font-medium tracking-[-0.045em] sm:text-[40px] sm:leading-tight">
            Follow the work.
          </h1>
          <p className="mt-3 max-w-lg text-xs leading-6 text-muted-foreground">
            Start with a process. Find its reported outcomes and the execution
            evidence behind them.
          </p>
        </div>
        <Button
          asChild
          variant="ghost"
          className="h-9 px-0 text-xs text-muted-foreground"
        >
          <Link href="/overview">
            Project overview
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </Link>
        </Button>
      </div>

      <StudioWorkspace
        className="border-primary/30 shadow-lg [&>aside]:bg-background/70 [&>aside]:border-primary/20"
        processes={
          <StudioProcessPane
            processes={
              snapshot.isPending || snapshot.error ? undefined : workflows
            }
            selected={filters.workflow}
            onSelect={(name) => update("workflow", name)}
            state={
              <DataState
                pending={snapshot.isPending}
                error={snapshot.error}
                retry={() => void snapshot.refetch()}
              />
            }
            directory={
              <Link
                href="/workflows"
                className="mt-4 inline-flex min-h-9 items-center gap-2 text-[11px] text-primary hover:underline"
              >
                Process directory
                <ArrowRight aria-hidden="true" className="size-3" />
              </Link>
            }
          />
        }
      >
        <div className="grid min-w-0 gap-6 bg-background/50 p-3 sm:p-5">
          <div className="order-2 min-w-0 lg:order-1">
            <ExploreAnalyticsContext exploreFrom={exploreFrom} />
          </div>
          <section
            aria-labelledby="evidence-title"
            className="order-1 min-w-0 overflow-hidden rounded-xl border border-primary/30 bg-card shadow-sm lg:order-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-[linear-gradient(110deg,hsl(var(--primary)/0.10),transparent_65%)] px-5 py-4 sm:px-6">
              <div className="flex items-center gap-2.5">
                <CircleDot aria-hidden="true" className="size-4 text-primary" />
                <h2
                  id="evidence-title"
                  tabIndex={-1}
                  className="text-xs font-medium"
                >
                  Execution evidence
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden font-mono text-[9px] uppercase tracking-wider text-muted-foreground sm:inline">
                  Full recorded history
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  aria-label="Refresh execution evidence"
                  disabled={list.isFetching}
                  onClick={() => void list.refetch()}
                >
                  <RotateCw
                    aria-hidden="true"
                    className={`size-3.5 ${list.isFetching ? "motion-safe:animate-spin" : ""}`}
                  />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 border-b border-border p-4 sm:px-6 sm:py-5">
              <label className="relative order-1 min-w-0 flex-[1_1_100%] lg:flex-[1_1_220px]">
                <span className="sr-only">Filter these runs</span>
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
                />
                <Input
                  type="search"
                  value={filters.search}
                  onChange={(event) => update("search", event.target.value)}
                  placeholder="Filter runs by ID, process, correlation or failure code…"
                  className="h-10 border-border bg-background/60 pl-9 text-xs placeholder:text-muted-foreground/70"
                />
              </label>
              <Button
                asChild
                variant="outline"
                className="order-3 h-10 gap-2 sm:h-9 bg-transparent text-xs"
              >
                <Link href={historyHref}>
                  <SlidersHorizontal aria-hidden="true" className="size-3.5" />
                  All filters
                  {activeFilters.length ? (
                    <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[9px]">
                      {activeFilters.length}
                    </span>
                  ) : null}
                </Link>
              </Button>
              <div className="order-2 min-w-0 flex-[1_1_110px] lg:hidden [&_label]:sr-only [&>div]:max-w-none [&_[data-slot=select-trigger]]:h-10 [&_[data-slot=select-trigger]]:text-[11px]">
                <FilterSelect
                  label="Process"
                  value={filters.workflow}
                  onChange={(value) => update("workflow", value)}
                  options={[
                    { value: "all", label: "All processes" },
                    ...workflows.map((workflow) => ({
                      value: workflow.name,
                      label: workflow.name,
                    })),
                  ]}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
              <div
                className="flex min-w-0 flex-wrap gap-1"
                aria-label="Execution status"
              >
                {executionStates.map((state) => (
                  <Button
                    key={state.value}
                    variant="ghost"
                    aria-pressed={filters.status === state.value}
                    onClick={() => update("status", state.value)}
                    className={`h-8 px-2.5 text-[10px] ${filters.status === state.value ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
                  >
                    {state.label}
                  </Button>
                ))}
              </div>
              <span
                aria-live="polite"
                className="text-[10px] tabular-nums text-muted-foreground"
              >
                {list.isPending
                  ? "Loading evidence…"
                  : list.error
                    ? "Evidence unavailable"
                    : `${total.toLocaleString()} matching ${total === 1 ? "run" : "runs"}`}
              </span>
            </div>
            {activeFilters.length > 0 ? (
              <div
                aria-label="Applied filters"
                className="flex flex-wrap items-center gap-2 border-b border-border bg-background/30 px-5 py-2 text-[10px] text-muted-foreground sm:px-6"
              >
                {activeFilters.map(([key, value]) => (
                  <Badge
                    key={key}
                    variant="outline"
                    className="max-w-full whitespace-normal break-all text-[9px]"
                  >
                    {explorerFilterLabels[key as keyof ExplorerFilters]}:{" "}
                    {key === "status" && value === "Running"
                      ? "No final outcome"
                      : value}
                  </Badge>
                ))}
                <Link
                  href={historyHref}
                  className="min-h-8 py-2 hover:text-foreground hover:underline"
                >
                  Review exact filters
                  <ArrowUpRight
                    aria-hidden="true"
                    className="ml-1 inline size-3"
                  />
                </Link>
                <Button
                  variant="ghost"
                  onClick={clearFilters}
                  className="ml-auto h-8 px-2 text-[10px]"
                >
                  <X aria-hidden="true" className="size-3" />
                  Clear
                </Button>
              </div>
            ) : null}
            <div className="px-5 sm:px-6">
              <DataState
                pending={list.isPending}
                error={list.error}
                retry={() => void list.refetch()}
              />
            </div>
            {!list.isPending && !list.error && runs.length > 0 ? (
              <ExploreRunList runs={runs} />
            ) : null}
            {!list.isPending && !list.error && runs.length === 0 ? (
              <div className="grid justify-items-center gap-3 px-6 py-16 text-center">
                <span className="mb-2 grid size-12 place-items-center rounded-xl border border-border bg-background">
                  <Search
                    aria-hidden="true"
                    className="size-5 text-muted-foreground"
                  />
                </span>
                <h3 className="text-base font-medium">
                  {activeFilters.length
                    ? "No evidence matches this view."
                    : "Your first process starts here."}
                </h3>
                <p className="max-w-sm text-xs leading-6 text-muted-foreground">
                  {activeFilters.length
                    ? "Try another process or clear the conditions to search the recorded history."
                    : "Instrument the work your application already owns. Its executions and reported results will appear here."}
                </p>
                {activeFilters.length ? (
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="mt-2 text-xs"
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button asChild variant="outline" className="mt-2 text-xs">
                    <a href={publicConfig.documentationUrl}>
                      <BookOpen aria-hidden="true" className="size-3.5" />
                      Instrumentation guide
                    </a>
                  </Button>
                )}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4 text-[10px] text-muted-foreground sm:px-6">
              <p>
                {list.isPending
                  ? "Loading history…"
                  : list.error
                    ? "History unavailable"
                    : `Showing ${runs.length} of ${total.toLocaleString()} · page ${pageIndex + 1}`}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 text-[11px] sm:h-8"
                  disabled={pageIndex === 0 || list.isFetching}
                  onClick={() =>
                    setCursorStack((stack) =>
                      stack.length > 1 ? stack.slice(0, -1) : stack,
                    )
                  }
                >
                  <ArrowLeft aria-hidden="true" className="size-3" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 text-[11px] sm:h-8"
                  disabled={!nextCursor || list.isFetching}
                  onClick={() =>
                    setCursorStack((stack) => [...stack, nextCursor])
                  }
                >
                  Next
                  <ArrowRight aria-hidden="true" className="size-3" />
                </Button>
              </div>
            </div>
          </section>
        </div>
      </StudioWorkspace>
      <p className="flex items-start gap-2 text-[10px] leading-6 text-muted-foreground">
        <ArrowDown aria-hidden="true" className="mt-1 size-3 shrink-0" />
        Open an execution to inspect its result, timeline, relationships and
        expected confirmations. Reported completion does not verify business
        success.
      </p>
    </div>
  )
}

export function StudioExplore() {
  const pathname = usePathname()
  const inspectorId = readInspectorRunId(pathname)
  const { projects, current, pending, error, retry } = useProject()
  if (error && !current) {
    return <DataState pending={false} error={error} retry={retry} />
  }
  if (pending || (!current && projects.length > 0)) {
    return (
      <div aria-label="Loading Studio" role="status" className="grid gap-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-5 w-72 max-w-full" />
        <Skeleton className="h-96 w-full rounded-xl" />
        <span className="sr-only">Loading Studio…</span>
      </div>
    )
  }
  if (!current) {
    return (
      <div className="mx-auto grid max-w-lg justify-items-center gap-5 py-20 text-center">
        <Workflow aria-hidden="true" className="size-10 text-primary" />
        <h1 className="text-3xl font-medium tracking-tight">
          A workspace for your application.
        </h1>
        <p className="text-sm leading-7 text-muted-foreground">
          Create a project to start collecting process evidence. Each project
          keeps its application’s data and access separate.
        </p>
        <Button asChild>
          <Link href="/settings?section=projects">
            Create your first project
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Button>
      </div>
    )
  }
  return (
    <>
      {error ? <DataState pending={false} error={error} retry={retry} /> : null}
      <ExploreWorkspace key={current.id} />
      {inspectorId ? <RunInspector key={inspectorId} id={inspectorId} /> : null}
    </>
  )
}
