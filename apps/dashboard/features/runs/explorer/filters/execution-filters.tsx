"use client"

import { Input } from "@flowmark/ui"
import { FilterSelect } from "../../../shared/dashboard-components"
import type { useRunExplorer } from "../use-run-explorer"

export function ExecutionFilters({
  filters,
  update,
}: Pick<ReturnType<typeof useRunExplorer>, "filters" | "update">) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <FilterSelect
        label="Expectation state"
        value={filters.expectationState}
        onChange={(value) => update("expectationState", value)}
        options={[
          { value: "all", label: "All expectations" },
          { value: "pending", label: "Pending confirmation" },
          {
            value: "overdue",
            label: "Overdue — no resolution observed",
          },
          { value: "met-on-time", label: "Observed on time" },
          { value: "met-late", label: "Observed late" },
          { value: "cancelled", label: "Cancelled" },
        ]}
      />
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
      <label className="grid min-w-0 flex-[1_1_140px] gap-2 text-sm text-muted-foreground sm:max-w-[160px]">
        <span>Started after</span>
        <Input
          type="date"
          value={filters.startedAfter}
          onChange={(event) => update("startedAfter", event.target.value)}
        />
      </label>
      <label className="grid min-w-0 flex-[1_1_140px] gap-2 text-sm text-muted-foreground sm:max-w-[160px]">
        <span>Started before</span>
        <Input
          type="date"
          value={filters.startedBefore}
          onChange={(event) => update("startedBefore", event.target.value)}
        />
      </label>
    </div>
  )
}
