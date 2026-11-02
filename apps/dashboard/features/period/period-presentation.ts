import { formatDuration } from "../../lib/format"
import { type PeriodDays } from "./period"

export function insightsPath(days: PeriodDays, workflow?: string) {
  return periodPath("/insights", days, workflow)
}

export function issuesPath(days: PeriodDays, workflow?: string) {
  return periodPath("/issues", days, workflow)
}

function periodPath(pathname: string, days: PeriodDays, workflow?: string) {
  const params = new URLSearchParams()
  if (days === 30) {
    params.set("days", "30")
  }
  if (workflow) {
    params.set("workflow", workflow)
  }
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

export function failedRunsPath(input: {
  readonly workflow?: string
  readonly code?: string
  readonly startedAfter: string
  readonly startedBefore: string
}) {
  const params = new URLSearchParams({
    status: "Failed",
    startedAfterExact: input.startedAfter,
    startedBeforeExclusive: input.startedBefore,
  })
  if (input.workflow) {
    params.set("workflow", input.workflow)
  }
  if (input.code) {
    params.set("failCode", input.code)
  }
  return `/runs?${params}`
}

export type RecordedChange = {
  readonly id: string
  readonly title: string
  readonly detail: string
  readonly href: string
}

type PeriodCounts = {
  readonly finishedRuns: number
  readonly failedRuns: number
  readonly successRate: number | null
}

export function recordedChanges(input: {
  readonly days: PeriodDays
  readonly workflow?: string
  readonly startedAfter: string
  readonly startedBefore: string
  readonly failureGroups: readonly {
    readonly workflow: string
    readonly code: string
    readonly currentCount: number
    readonly countDelta: number
  }[]
  readonly workflows: readonly {
    readonly name: string
    readonly current: PeriodCounts
    readonly previous: PeriodCounts
  }[]
  readonly operations: readonly {
    readonly name: string
    readonly currentRunCount: number
    readonly previousRunCount: number
    readonly currentMedianDurationMs: number | null
    readonly previousMedianDurationMs: number | null
    readonly durationDeltaMs: number | null
    readonly currentRunIds: readonly string[]
  }[]
}): readonly RecordedChange[] {
  const failures = [...input.failureGroups]
    .filter((group) => group.countDelta > 0)
    .sort(
      (left, right) =>
        right.countDelta - left.countDelta ||
        right.currentCount - left.currentCount,
    )
    .slice(0, 3)
    .map((group) => ({
      id: `failure:${group.workflow}:${group.code}`,
      title: group.code
        ? `${group.code} on ${group.workflow}`
        : `Failures without a code on ${group.workflow}`,
      detail: `${countNoun(group.currentCount, "failed run", "failed runs")} in this window, ${signed(group.countDelta)} versus the previous window.`,
      href: failedRunsPath({
        workflow: group.workflow,
        code: group.code,
        startedAfter: input.startedAfter,
        startedBefore: input.startedBefore,
      }),
    }))
  const covered = new Set(
    [...input.failureGroups]
      .filter((group) => group.countDelta > 0)
      .sort(
        (left, right) =>
          right.countDelta - left.countDelta ||
          right.currentCount - left.currentCount,
      )
      .slice(0, 3)
      .map((group) => group.workflow),
  )
  const workflows = input.workflows
    .filter(
      (item) =>
        !covered.has(item.name) &&
        item.current.finishedRuns >= 5 &&
        item.previous.finishedRuns >= 5 &&
        item.current.failedRuns > item.previous.failedRuns,
    )
    .sort(
      (left, right) =>
        right.current.failedRuns -
        right.previous.failedRuns -
        (left.current.failedRuns - left.previous.failedRuns),
    )
    .slice(0, 2)
    .map((item) => ({
      id: `workflow:${item.name}`,
      title: `${item.name} failed more often`,
      detail: `${item.current.failedRuns.toLocaleString()} failed runs versus ${item.previous.failedRuns.toLocaleString()} in the previous window. Completion ${rate(item.current.successRate)} versus ${rate(item.previous.successRate)}.`,
      href: issuesPath(input.days, item.name),
    }))
  const durations = [...input.operations]
    .filter(
      (operation) =>
        operation.durationDeltaMs != null &&
        operation.durationDeltaMs > 0 &&
        operation.currentRunCount >= 3 &&
        operation.previousRunCount >= 3,
    )
    .sort(
      (left, right) =>
        (right.durationDeltaMs ?? 0) - (left.durationDeltaMs ?? 0),
    )
    .slice(0, 2)
    .map((operation) => ({
      id: `duration:${operation.name}`,
      title: `${operation.name} took longer`,
      detail: input.workflow
        ? `Median ${formatDuration(operation.currentMedianDurationMs)} versus ${formatDuration(operation.previousMedianDurationMs)} on ${input.workflow}, across ${operation.currentRunCount.toLocaleString()} runs. A larger median is a recorded difference, not a confirmed anomaly.`
        : `Median ${formatDuration(operation.currentMedianDurationMs)} versus ${formatDuration(operation.previousMedianDurationMs)} for this operation name across workflows, from ${operation.currentRunCount.toLocaleString()} runs. A larger median is a recorded difference, not a confirmed anomaly.`,
      href: operation.currentRunIds[0]
        ? `/runs/${operation.currentRunIds[0]}`
        : insightsPath(input.days, input.workflow),
    }))
  return [...failures, ...workflows, ...durations].slice(0, 5)
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString()}`
}

function countNoun(count: number, singular: string, plural: string) {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`
}

function rate(value: number | null) {
  return value == null ? "—" : `${value}%`
}
