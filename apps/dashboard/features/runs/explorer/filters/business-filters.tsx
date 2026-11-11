"use client"

import { Button, Input } from "@flowmark/ui"
import Link from "next/link"
import { FilterSelect } from "../../../shared/dashboard-components"
import type { useRunExplorer } from "../use-run-explorer"

export function BusinessFilters({
  filters,
  setFilters,
  setCursorStack,
  update,
  selectedWorkflow,
  searchFields,
  selectedField,
}: Pick<
  ReturnType<typeof useRunExplorer>,
  | "filters"
  | "setFilters"
  | "setCursorStack"
  | "update"
  | "selectedWorkflow"
  | "searchFields"
  | "selectedField"
>) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
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
          <Button variant="outline" onClick={() => void searchFields.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {selectedWorkflow && searchFields.data?.length === 0 && (
        <p className="text-sm">
          No business fields are enabled for this workflow.{" "}
          <Link
            className="font-medium text-primary underline"
            href={`/workflows/${encodeURIComponent(selectedWorkflow)}?view=configuration`}
          >
            Configure searchable fields
          </Link>
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
            update("businessValue", value === "__unset__" ? "" : value.slice(6))
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
        <label className="grid gap-2 text-sm text-muted-foreground">
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
  )
}
