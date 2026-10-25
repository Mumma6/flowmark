import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "@flowmark/server/trpc"

export type Snapshot = inferRouterOutputs<AppRouter>["project"]["snapshot"]
export type Run = Snapshot["runs"][number]
export type WorkflowSummary = Snapshot["workflows"][number]

export function workflowFamily(name: string) {
  const businessName = name.startsWith("browser.") ? name.slice(8) : name
  return businessName.includes(".") ? businessName.split(".")[0]! : "Other"
}

export function formatDuration(value: number | null) {
  if (value === null) {
    return "Not reported"
  }
  return value < 1000
    ? `${Math.round(value)} ms`
    : `${(value / 1000).toFixed(2)} s`
}

export function formatTimestamp(value: string) {
  return new Date(value).toISOString().replace("T", " ").slice(0, 19)
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

export function paginate<T>(
  items: readonly T[],
  requestedPage: number,
  pageSize: number,
) {
  const pages = Math.max(1, Math.ceil(items.length / pageSize))
  const page = Math.max(1, Math.min(requestedPage, pages))
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pages,
    total: items.length,
  }
}

export function groupBy<T>(items: readonly T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const name = key(item)
    const group = groups.get(name)
    if (group) {
      group.push(item)
    } else {
      groups.set(name, [item])
    }
  }
  return [...groups]
}
