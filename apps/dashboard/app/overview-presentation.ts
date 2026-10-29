import { formatDuration, type Intelligence } from "./dashboard-data"

export function windowLabel(window: {
  startedAfter: string
  startedBefore: string
}) {
  const end = new Date(Date.parse(window.startedBefore) - 1)
    .toISOString()
    .slice(0, 10)
  return `${window.startedAfter.slice(0, 10)} – ${end}`
}

function delta(current: number | null, previous: number | null, unit: string) {
  if (current == null || previous == null) {
    return undefined
  }
  const value = Math.round((current - previous) * 10) / 10
  return `${value > 0 ? "+" : ""}${value}${unit} vs previous 7 days`
}

export function overviewMetrics(
  data: Pick<Intelligence, "current" | "previous">,
) {
  const { current, previous } = data
  const baseline = previous.totalRuns > 0
  return [
    {
      label: "Recorded runs",
      value: current.totalRuns.toLocaleString(),
      note: "Recorded executions",
      change: baseline
        ? delta(current.totalRuns, previous.totalRuns, " runs")
        : undefined,
    },
    {
      label: "Run completion",
      value: current.successRate == null ? "—" : `${current.successRate}%`,
      note: "Among finished runs",
      change: baseline
        ? delta(current.successRate, previous.successRate, " pp")
        : undefined,
    },
    {
      label: "Failed runs",
      value: current.failedRuns.toLocaleString(),
      note: "Reported failures",
      change: baseline
        ? delta(current.failedRuns, previous.failedRuns, " runs")
        : undefined,
    },
    {
      label: "p95 duration",
      value:
        current.p95DurationMs == null
          ? "—"
          : formatDuration(current.p95DurationMs),
      note: "95% finished within",
      change: baseline
        ? delta(current.p95DurationMs, previous.p95DurationMs, " ms")
        : undefined,
    },
  ]
}
