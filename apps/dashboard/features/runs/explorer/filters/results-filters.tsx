"use client"

import { Button, Input } from "@flowmark/ui"
import { FilterSelect } from "../../../shared/dashboard-components"
import type { useRunExplorer } from "../use-run-explorer"

export function ResultsFilters({
  filters,
  setFilters,
  setCursorStack,
  update,
  declarations,
  resultFields,
}: Pick<
  ReturnType<typeof useRunExplorer>,
  | "filters"
  | "setFilters"
  | "setCursorStack"
  | "update"
  | "declarations"
  | "resultFields"
>) {
  return (
    <section
      aria-label="Final result filters"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
    >
      <p className="text-sm text-muted-foreground sm:col-span-2 xl:col-span-3">
        Final result selection · explicit original-start definition; completed
        and failed runs. Between-period reports are excluded.
      </p>
      {declarations.error && (
        <p role="alert">
          Could not load result declarations.{" "}
          <Button variant="outline" onClick={() => void declarations.refetch()}>
            Retry
          </Button>
        </p>
      )}
      <label className="text-sm">
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
          <label className="text-sm">
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
            <label className="text-sm">
              Declared reason
              <Input
                value={filters.resultReason}
                onChange={(event) => update("resultReason", event.target.value)}
              />
            </label>
          )}
        </>
      )}
    </section>
  )
}
