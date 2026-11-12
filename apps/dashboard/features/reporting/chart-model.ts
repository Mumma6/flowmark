import type { Snapshot } from "../platform/api-types"
import { type ChartConfig } from "@flowmark/ui"

export const volumeConfig = {
  completed: {
    label: "Completed",
    color: "hsl(var(--chart-1))",
  },
  failed: {
    label: "Failed",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig

export const durationConfig = {
  median: {
    label: "Median",
    color: "hsl(var(--chart-1))",
  },
  p95: {
    label: "p95",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export const operationConfig = {
  duration: {
    label: "Total time",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

export const failureConfig = {
  count: {
    label: "Failed runs",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig

export const compareConfig = {
  current: {
    label: "This run",
    color: "hsl(var(--chart-1))",
  },
  median: {
    label: "Peer median",
    color: "hsl(var(--chart-2))",
  },
  p95: {
    label: "Peer p95",
    color: "hsl(var(--chart-4))",
  },
} satisfies ChartConfig

export function axisDuration(value: number) {
  return value < 1000
    ? `${Math.round(value)}ms`
    : `${(value / 1000).toFixed(1)}s`
}

export function shortLabel(value: string, max = 20) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

export const dailyVolumeData = (daily: Readonly<Snapshot["daily"]>) =>
  daily.map((day) => ({
    date: day.date,
    completed: day.completed,
    failed: day.failed,
    successRate: day.successRate,
  }))

export const dailyDurationData = (daily: Readonly<Snapshot["daily"]>) =>
  daily.map((day) => ({
    date: day.date,
    median: day.medianDurationMs,
    p95: day.p95DurationMs,
  }))

export const operationDurationData = (
  operations: Readonly<Snapshot["operations"]>,
) =>
  operations.slice(0, 8).map((item) => ({
    label: shortLabel(item.name),
    duration: item.totalDurationMs,
    name: item.name,
    workflow: item.workflow,
  }))

export const failureCodeData = (codes: Readonly<Snapshot["failureCodes"]>) =>
  codes.slice(0, 8).map((item) => ({
    label: shortLabel(item.code),
    count: item.count,
    code: item.code,
    workflow: item.workflow,
  }))

export const chartHeight = (count: number) =>
  count <= 1 ? "h-[140px]" : count <= 3 ? "h-[200px]" : "h-[240px]"
