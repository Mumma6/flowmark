"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Input,
} from "@flowmark/ui"
import { Search } from "lucide-react"
import { DataState, FilterSelect } from "../shared/dashboard-components"
import { explorerDefaults, type ExplorerFilters } from "./explorer-filters"
import { RunsTable } from "./runs-table"
import { useRunExplorer } from "./use-run-explorer"

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
        <FilterSelect
          label="Expectation state"
          value={filters.expectationState}
          onChange={(value) => update("expectationState", value)}
          options={[
            { value: "all", label: "All expectations" },
            { value: "pending", label: "Pending confirmation" },
            { value: "overdue", label: "Overdue — no resolution observed" },
            { value: "met-on-time", label: "Observed on time" },
            { value: "met-late", label: "Observed late" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
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
      <section
        aria-label="Final result filters"
        className="grid gap-3 border-b border-border p-5 sm:grid-cols-2 xl:grid-cols-3"
      >
        <p className="text-sm text-muted-foreground sm:col-span-2 xl:col-span-3">
          Final result selection · explicit original-start definition; completed
          and failed runs. Between-period reports are excluded.
        </p>
        {declarations.error && (
          <p role="alert">
            Could not load result declarations.{" "}
            <Button
              variant="outline"
              onClick={() => void declarations.refetch()}
            >
              Retry
            </Button>
          </p>
        )}
        <label className="text-xs">
          Canonical outcome
          <Input
            value={filters.outcome}
            maxLength={64}
            onChange={(event) => update("outcome", event.target.value)}
          />
        </label>
        <FilterSelect
          label="Result definition revision"
          value={filters.definitionRevision || "__all__"}
          onChange={(value) => {
            setFilters({
              ...filters,
              definitionRevision: value === "__all__" ? "" : value,
              resultPath: "",
              resultReason: "",
            })
            setCursorStack([null])
          }}
          options={[
            { value: "__all__", label: "All definitions" },
            ...(declarations.data ?? []).map((item) => ({
              value: item.revision,
              label: item.revision,
            })),
          ]}
        />
        <FilterSelect
          label="Final result field"
          value={filters.resultPath || "__none__"}
          onChange={(value) => {
            const selected = resultFields.find(
              (item) => JSON.stringify(item.path) === value,
            )
            setFilters({
              ...filters,
              resultPath: value === "__none__" ? "" : value,
              resultKind: selected?.kind === "category" ? "category" : "count",
              resultOperator: "eq",
              resultValue: "",
              resultReason: "",
            })
            setCursorStack([null])
          }}
          options={[
            { value: "__none__", label: "No result predicate" },
            ...resultFields.map((item) => ({
              value: JSON.stringify(item.path),
              label: item.label,
            })),
          ]}
        />
        {filters.resultPath && (
          <>
            <FilterSelect
              label="Result operator"
              value={filters.resultOperator || "eq"}
              onChange={(value) => update("resultOperator", value)}
              options={
                filters.resultKind === "category"
                  ? [{ value: "eq", label: "Equals" }]
                  : [
                      { value: "eq", label: "Equals" },
                      { value: "gte", label: "At least" },
                      { value: "lte", label: "At most" },
                    ]
              }
            />
            <label className="text-xs">
              Result value
              <Input
                type={filters.resultKind === "category" ? "text" : "number"}
                min={0}
                step={1}
                value={filters.resultValue}
                onChange={(event) => update("resultValue", event.target.value)}
              />
            </label>
            {resultFields.find(
              (item) => JSON.stringify(item.path) === filters.resultPath,
            )?.kind === "reasons" && (
              <label className="text-xs">
                Declared reason
                <Input
                  value={filters.resultReason}
                  onChange={(event) =>
                    update("resultReason", event.target.value)
                  }
                />
              </label>
            )}
          </>
        )}
        {(filters.startedAfterExact ||
          filters.startedBeforeExact ||
          filters.startedBeforeExclusive ||
          filters.terminalOnly) && (
          <p className="text-xs text-muted-foreground sm:col-span-2 xl:col-span-3">
            Evidence cohort: {filters.startedAfterExact || "unbounded start"}{" "}
            inclusive →{" "}
            {filters.startedBeforeExact ||
              filters.startedBeforeExclusive ||
              "unbounded end"}{" "}
            {filters.startedBeforeExact ? "inclusive" : "exclusive"};{" "}
            {filters.startedBeforeExact && filters.startedBeforeExclusive && (
              <>also before {filters.startedBeforeExclusive} exclusive; </>
            )}
            {filters.status !== "all"
              ? filters.status
              : filters.terminalOnly === "true"
                ? "finished runs only"
                : "all statuses"}
            . Clear filters to leave this cohort.
          </p>
        )}
      </section>
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
        <p className="text-xs text-muted-foreground">
          Full recorded history · page {pageIndex + 1}
        </p>
      </div>
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
                {
                  (
                    {
                      ratioNumerator: "Ratio numerator",
                      ratioDenominator: "Ratio denominator",
                      definitionRevision: "Definition",
                      outcome: "Outcome",
                      terminalOnly: "Finished only",
                      expectationState: "Expectation state",
                      startedBeforeExact: "Before (exact)",
                      startedAfterExact: "After (exact)",
                      startedBeforeExclusive: "Before (exclusive)",
                      resultPath: "Result path",
                      resultOperator: "Result operator",
                      resultValue: "Result value",
                      resultKind: "Result type",
                      resultReason: "Reason",
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
