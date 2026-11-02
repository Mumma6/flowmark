import type {
  FailureGroup,
  PeriodCounts,
  WorkflowPeriodComparison,
} from "../types.js"

export type WorkflowPeriodRow = {
  readonly name: string
  readonly period: "current" | "previous"
  readonly totalRuns: number
  readonly finishedRuns: number
  readonly completedRuns: number
  readonly failedRuns: number
  readonly successRate: number | null
  readonly medianDurationMs: number | null
  readonly p95DurationMs: number | null
}

export type FailureGroupRow = {
  readonly workflow: string
  readonly code: string
  readonly currentCount: number
  readonly previousCount: number
  readonly lastStartedAt: string | Date | null
  readonly runIds: unknown
}

const emptyCounts: PeriodCounts = {
  totalRuns: 0,
  finishedRuns: 0,
  completedRuns: 0,
  failedRuns: 0,
  successRate: null,
  medianDurationMs: null,
  p95DurationMs: null,
}

function counts(row: WorkflowPeriodRow | undefined): PeriodCounts {
  if (!row) {
    return emptyCounts
  }
  return {
    totalRuns: row.totalRuns,
    finishedRuns: row.finishedRuns,
    completedRuns: row.completedRuns,
    failedRuns: row.failedRuns,
    successRate: row.successRate,
    medianDurationMs: row.medianDurationMs,
    p95DurationMs: row.p95DurationMs,
  }
}

export function assembleWorkflowPeriods(
  rows: readonly WorkflowPeriodRow[],
): readonly WorkflowPeriodComparison[] {
  const byName = new Map<
    string,
    { current?: WorkflowPeriodRow; previous?: WorkflowPeriodRow }
  >()
  for (const row of rows) {
    if (row.period !== "current" && row.period !== "previous") {
      continue
    }
    const entry = byName.get(row.name) ?? {}
    entry[row.period] = row
    byName.set(row.name, entry)
  }
  return [...byName.entries()]
    .map(([name, periods]) => ({
      name,
      current: counts(periods.current),
      previous: counts(periods.previous),
    }))
    .sort(
      (left, right) =>
        right.current.totalRuns - left.current.totalRuns ||
        left.name.localeCompare(right.name),
    )
}

function timestamp(value: string | Date | null): string | null {
  if (value == null) {
    return null
  }
  return value instanceof Date ? value.toISOString() : value
}

function runIds(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .slice(0, 5)
}

export function assembleFailureGroups(rows: readonly FailureGroupRow[]): {
  readonly groups: readonly FailureGroup[]
  readonly truncated: boolean
} {
  return {
    truncated: rows.length > 50,
    groups: rows.slice(0, 50).map((row) => ({
      workflow: row.workflow,
      code: row.code,
      currentCount: row.currentCount,
      previousCount: row.previousCount,
      countDelta: row.currentCount - row.previousCount,
      lastStartedAt: timestamp(row.lastStartedAt),
      runIds: runIds(row.runIds),
    })),
  }
}
