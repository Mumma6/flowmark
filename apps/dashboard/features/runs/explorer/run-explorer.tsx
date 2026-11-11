"use client"

import { Badge, Button, Input } from "@flowmark/ui"
import { PageSections } from "../../shared/page-sections"
import { Search } from "lucide-react"
import { DataState, FilterSelect } from "../../shared/dashboard-components"
import {
  explorerDefaults,
  explorerFilterLabels,
  type ExplorerFilters,
} from "./explorer-filters"
import { RunsTable } from "./runs-table"
import { useRunExplorer } from "./use-run-explorer"
import { selectRunFilterGroup } from "./filter-group"
import { ExecutionFilters } from "./filters/execution-filters"
import { ResultsFilters } from "./filters/results-filters"
import { BusinessFilters } from "./filters/business-filters"
import { TechnicalFilters } from "./filters/technical-filters"

export function RunExplorer({
  workflow,
  workflowNames = [],
}: {
  workflow?: string
  workflowNames?: readonly string[]
  initialSearch?: string
}) {
  const {
    filters,
    setFilters,
    setCursorStack,
    pageIndex,
    update,
    selectedWorkflow,
    searchFields,
    declarations,
    resultFields,
    selectedField,
    list,
    runs,
    total,
    nextCursor,
  } = useRunExplorer(workflow)
  const filterSection = selectRunFilterGroup(filters)
  return (
    <div>
      {filters.expectationState !== "all" &&
        !filters.startedAfter &&
        !filters.startedAfterExact && (
          <p className="px-5 py-3 text-sm text-muted-foreground">
            Expectation discovery uses the last 30 days unless dates are
            supplied. Counts describe retained observed evidence.
          </p>
        )}
      <div className="flex flex-wrap items-end gap-3 border-b border-border/60 bg-muted/20 p-5">
        <label className="grid min-w-0 flex-[1_1_240px] gap-2 text-sm text-muted-foreground sm:max-w-[360px]">
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
      </div>
      <div className="border-b border-border p-5">
        <PageSections
          label="Run filter groups"
          queryKey="filterView"
          defaultValue={filterSection}
          sections={[
            {
              value: "execution",
              label: "Execution",
              description:
                "Narrow by status, confirmation state or start date. All selected filters remain applied when you switch filter groups.",
              content: <ExecutionFilters filters={filters} update={update} />,
            },
            {
              value: "results",
              label: "Reported results",
              description:
                "Find completed or failed runs by their final reported outcome or a declared result field. Choose a workflow above to load its definitions.",
              content: (
                <ResultsFilters
                  filters={filters}
                  setFilters={setFilters}
                  setCursorStack={setCursorStack}
                  update={update}
                  declarations={declarations}
                  resultFields={resultFields}
                />
              ),
            },
            {
              value: "business",
              label: "Business reference",
              description:
                "Choose a workflow above, then look up an enabled reference or category by its exact value.",
              content: (
                <BusinessFilters
                  filters={filters}
                  setFilters={setFilters}
                  setCursorStack={setCursorStack}
                  update={update}
                  selectedWorkflow={selectedWorkflow}
                  searchFields={searchFields}
                  selectedField={selectedField}
                />
              ),
            },
            {
              value: "technical",
              label: "Technical context",
              description:
                "Narrow the same run list to a failure code, environment, release or namespace.",
              content: <TechnicalFilters filters={filters} update={update} />,
            },
          ]}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 px-5 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setFilters({ ...explorerDefaults, search: "" })
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
        <p className="text-sm text-muted-foreground">
          Full recorded history · page {pageIndex + 1}
        </p>
      </div>
      {(filters.startedAfterExact ||
        filters.startedBeforeExact ||
        filters.startedBeforeExclusive ||
        filters.terminalOnly) && (
        <p className="px-5 pb-3 text-sm leading-6 text-muted-foreground">
          This list keeps the time window and execution scope from the evidence
          link. The chips below show its exact boundaries. Date filters add
          conditions; clear filters to search the full history.
        </p>
      )}
      {Object.entries(filters).some(
        ([key, value]) =>
          value !== explorerDefaults[key as keyof ExplorerFilters],
      ) && (
        <div
          className="flex flex-wrap gap-2 px-5 pb-3"
          aria-label="Applied filters"
        >
          {Object.entries(filters)
            .filter(
              ([key, value]) =>
                value !== explorerDefaults[key as keyof ExplorerFilters],
            )
            .map(([key, value]) => (
              <Badge key={key} variant="secondary">
                {explorerFilterLabels[key as keyof ExplorerFilters]}:{" "}
                {key === "status" && value === "Running"
                  ? "No final outcome"
                  : value}
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
        <p className="text-sm text-muted-foreground">
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
