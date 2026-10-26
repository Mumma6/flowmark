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

export function percentile(values: readonly number[], p: number) {
  if (values.length === 0) {
    return null
  }
  const sorted = [...values].sort((left, right) => left - right)
  const index = (sorted.length - 1) * p
  const low = Math.floor(index)
  const high = Math.ceil(index)
  const lower = sorted[low]
  if (lower === undefined) {
    return null
  }
  const upper = sorted[high]
  if (upper === undefined || low === high) {
    return lower
  }
  return lower + (upper - lower) * (index - low)
}

export type DayInsight = Snapshot["daily"][number]

export function summarizeDays(days: readonly DayInsight[]) {
  const count = days.reduce((sum, day) => sum + day.count, 0)
  const completed = days.reduce((sum, day) => sum + day.completed, 0)
  const failed = days.reduce((sum, day) => sum + day.failed, 0)
  const finished = completed + failed
  return {
    count,
    failed,
    successRate:
      finished === 0 ? null : Math.round((1000 * completed) / finished) / 10,
  }
}

export function weekOverWeek(daily: readonly DayInsight[]) {
  return {
    current: summarizeDays(daily.slice(-7)),
    previous: summarizeDays(daily.slice(-14, -7)),
  }
}

export function durationInRange(
  runs: readonly Run[],
  startDate: string,
  endDate: string,
) {
  const values = runs.flatMap((run) => {
    const day = run.startedAt.slice(0, 10)
    return day >= startDate && day <= endDate && run.durationMs != null
      ? [run.durationMs]
      : []
  })
  return {
    median: percentile(values, 0.5),
    p95: percentile(values, 0.95),
  }
}

/** Client-side daily counts from a run slice (e.g. latest 100 for one workflow). */
export function dailyFromRuns(runs: readonly Run[], days = 30): DayInsight[] {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const byDate = new Map<
    string,
    {
      completed: number
      failed: number
      running: number
      durations: number[]
    }
  >()
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today)
    date.setUTCDate(today.getUTCDate() - offset)
    byDate.set(date.toISOString().slice(0, 10), {
      completed: 0,
      failed: 0,
      running: 0,
      durations: [],
    })
  }
  for (const run of runs) {
    const day = run.startedAt.slice(0, 10)
    const bucket = byDate.get(day)
    if (!bucket) {
      continue
    }
    if (run.status === "Completed") {
      bucket.completed += 1
    } else if (run.status === "Failed") {
      bucket.failed += 1
    } else {
      bucket.running += 1
    }
    if (run.durationMs != null) {
      bucket.durations.push(run.durationMs)
    }
  }
  return [...byDate.entries()].map(([date, bucket]) => {
    const finished = bucket.completed + bucket.failed
    return {
      date,
      count: finished + bucket.running,
      completed: bucket.completed,
      failed: bucket.failed,
      successRate:
        finished === 0
          ? null
          : Math.round((1000 * bucket.completed) / finished) / 10,
      medianDurationMs: percentile(bucket.durations, 0.5),
      p95DurationMs: percentile(bucket.durations, 0.95),
    }
  })
}

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

export function percentChange(current: number | null, previous: number | null) {
  if (current == null || previous == null || previous === 0) {
    return null
  }
  return Math.round((1000 * (current - previous)) / previous) / 10
}

const shareWidths = {
  0: "w-0",
  10: "w-[10%]",
  20: "w-[20%]",
  30: "w-[30%]",
  40: "w-[40%]",
  50: "w-[50%]",
  60: "w-[60%]",
  70: "w-[70%]",
  80: "w-[80%]",
  90: "w-[90%]",
  100: "w-full",
} as const

export function shareWidthClass(percent: number) {
  const bucket = Math.min(
    100,
    Math.max(0, Math.round(percent / 10) * 10),
  ) as keyof typeof shareWidths
  return shareWidths[bucket]
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
