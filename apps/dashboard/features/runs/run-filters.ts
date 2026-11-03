import type { Run } from "../platform/api-types"

export function workflowOutliers(runs: readonly Run[], limit = 3) {
  const failed = [...runs]
    .filter((run) => run.status === "Failed")
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, limit)
  const longest = [...runs]
    .filter((run) => run.durationMs != null)
    .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
    .slice(0, limit)
  return { failed, longest }
}

export interface RunFilters {
  search: string
  status: string
  workflow: string
  namespace: string
  sort: string
}

export function filterRuns(runs: readonly Run[], filters: RunFilters) {
  const query = filters.search.trim().toLowerCase()
  return runs
    .filter(
      (run) =>
        (filters.status === "all" || run.status === filters.status) &&
        (filters.workflow === "all" || run.workflow === filters.workflow) &&
        (filters.namespace === "all" ||
          (filters.namespace === "browser"
            ? run.workflow.startsWith("browser.")
            : !run.workflow.startsWith("browser."))) &&
        (!query ||
          `${run.externalId} ${run.workflow} ${run.step ?? ""} ${run.correlationId ?? ""} ${run.parentRunId ?? ""}`
            .toLowerCase()
            .includes(query)),
    )
    .sort((a, b) =>
      filters.sort === "duration"
        ? (b.durationMs ?? -1) - (a.durationMs ?? -1) ||
          b.startedAt.localeCompare(a.startedAt)
        : b.startedAt.localeCompare(a.startedAt),
    )
}
