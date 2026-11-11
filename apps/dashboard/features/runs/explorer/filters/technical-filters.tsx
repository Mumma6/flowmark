"use client"

import { Input } from "@flowmark/ui"
import { FilterSelect } from "../../../shared/dashboard-components"
import type { useRunExplorer } from "../use-run-explorer"

export function TechnicalFilters({
  filters,
  update,
}: Pick<ReturnType<typeof useRunExplorer>, "filters" | "update">) {
  return (
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
      <label className="grid min-w-0 flex-[1_1_140px] gap-2 text-sm text-muted-foreground sm:max-w-[200px]">
        <span>Fail code</span>
        <Input
          value={filters.failCode}
          placeholder="e.g. LOAD_FAILED"
          onChange={(event) => update("failCode", event.target.value)}
        />
      </label>
      <label className="grid min-w-0 flex-[1_1_140px] gap-2 text-sm text-muted-foreground sm:max-w-[180px]">
        <span>Environment</span>
        <Input
          value={filters.environment}
          placeholder="production"
          onChange={(event) => update("environment", event.target.value)}
        />
      </label>
      <label className="grid min-w-0 flex-[1_1_140px] gap-2 text-sm text-muted-foreground sm:max-w-[180px]">
        <span>Release</span>
        <Input
          value={filters.release}
          placeholder="2026.10.2"
          onChange={(event) => update("release", event.target.value)}
        />
      </label>
    </div>
  )
}
