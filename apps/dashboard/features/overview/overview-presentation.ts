import { type Intelligence } from "../platform/api-types"
import { formatDuration } from "../shared/format"

function delta(
  current: number | null,
  previous: number | null,
  unit: string,
  comparison: string,
) {
  if (current == null || previous == null) {
    return undefined
  }
  const value = Math.round((current - previous) * 10) / 10
  return `${value > 0 ? "+" : ""}${value}${unit} vs ${comparison}`
}

export function overviewMetrics(
  data: Pick<Intelligence, "current" | "previous">,
  comparison = "previous 7 days",
) {
  const { current, previous } = data
  const baseline = previous.totalRuns > 0
  return [
    {
      label: "Recorded runs",
      value: current.totalRuns.toLocaleString(),
      note: "Runs started in the window",
      change: baseline
        ? delta(current.totalRuns, previous.totalRuns, " runs", comparison)
        : undefined,
    },
    {
      label: "Run completion",
      value: current.successRate == null ? "—" : `${current.successRate}%`,
      note: "Completed among finished runs",
      change: baseline
        ? delta(current.successRate, previous.successRate, " pp", comparison)
        : undefined,
    },
    {
      label: "Failed runs",
      value: current.failedRuns.toLocaleString(),
      note: "Explicit technical failures",
      change: baseline
        ? delta(current.failedRuns, previous.failedRuns, " runs", comparison)
        : undefined,
    },
    {
      label: "p95 duration",
      value:
        current.p95DurationMs == null
          ? "—"
          : formatDuration(current.p95DurationMs),
      note: "95% of measured runs finished within",
      change: baseline
        ? delta(
            current.p95DurationMs,
            previous.p95DurationMs,
            " ms",
            comparison,
          )
        : undefined,
    },
  ]
}
