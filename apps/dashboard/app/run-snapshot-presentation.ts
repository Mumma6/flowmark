import type { RunSnapshotMilestone, RunSnapshotProps } from "@flowmark/ui"
import { formatDuration, formatTimestamp } from "./dashboard-data"
import type { RunEvent } from "./run-event-table"
import { getRunDurationMs, getRunResultHighlights } from "./run-presentation"

const descriptions: Record<string, string> = {
  started:
    "The application reported the start of this execution. This alone does not establish whether work is still active.",
  step: "A checkpoint reported by application code. Its name and properties are shown as recorded.",
  completed:
    "The application reported completion. Read its result separately; completion does not mean every record succeeded.",
  failed:
    "The application reported terminal failure. Any attached result can describe partial work.",
  progress:
    "An absolute progress snapshot, not a heartbeat or proof of active work.",
  error:
    "An observed error. The handled flag records whether application code reported recovery; it does not decide the run outcome.",
}

export function buildRunSnapshot(
  events: readonly RunEvent[],
): RunSnapshotProps | null {
  const first = events[0]
  if (!first) {
    return null
  }
  const failure = events.find((event) => event.type === "failed")
  const completed = [...events]
    .reverse()
    .find((event) => event.type === "completed")
  const result = failure?.result ?? completed?.result
  const outcome = (failure ?? completed)?.outcome
  const status = failure ? "Failed" : completed ? "Completed" : "Running"
  const lastProgress = [...events]
    .reverse()
    .find((event) => event.type === "progress")
  const candidates = events.filter((event) =>
    event.type === "progress"
      ? event === lastProgress
      : ["step", "error", "completed", "failed"].includes(event.type),
  )
  const selected = (candidates.length > 0 ? candidates : [first]).slice(-8)
  const milestones: RunSnapshotMilestone[] = selected.map((event) => {
    const kind =
      event.type === "completed"
        ? "completed"
        : event.type === "failed"
          ? "failed"
          : event.type === "error"
            ? "error"
            : event.type === "progress"
              ? "progress"
              : "checkpoint"
    const label =
      event.type === "step"
        ? (event.step ?? "Checkpoint")
        : event.type === "completed"
          ? "Reported result"
          : event.type === "failed"
            ? "Run failed"
            : event.type === "progress"
              ? "Progress reported"
              : event.type === "error"
                ? (event.error?.code ?? "Error observed")
                : "Run started"
    const payload =
      event.outcome != null
        ? { outcome: event.outcome, result: event.result, error: event.error }
        : event.type === "progress"
          ? { completed: event.completed, total: event.total, unit: event.unit }
          : (event.error ??
            event.result ??
            event.properties ?? { type: event.type })
    return {
      id: event.id,
      label,
      time: `+${formatDuration(Math.max(0, Date.parse(event.timestamp) - Date.parse(first.timestamp)))}`,
      kind,
      title: label,
      description: descriptions[event.type] ?? "Application-reported event.",
      payload: JSON.stringify(payload, null, 2),
      note: `${event.type} · ${formatTimestamp(event.timestamp)}`,
      ...(event.type === "progress" && event.completed != null
        ? {
            progress: {
              completed: event.completed,
              total: event.total,
              unit: event.unit,
            },
          }
        : {}),
    }
  })
  const metrics = getRunResultHighlights(result ?? {})
    .slice(0, outcome == null ? 4 : 3)
    .map((item) => ({
      label: item.label,
      value: item.value,
      note: "Application-reported",
    }))
  if (outcome != null) {
    metrics.unshift({
      label: "Business outcome",
      value: outcome,
      note: "Explicit application report",
    })
  }
  if (metrics.length > 0 && metrics.length < 4) {
    metrics.push({
      label: "Recorded events",
      value: String(events.length),
      note: "Persisted telemetry",
    })
  }
  return {
    workflow: first.workflow,
    externalId: first.externalId,
    environment: first.environment,
    release: first.release,
    startedAt: `${formatTimestamp(first.timestamp)} UTC`,
    duration: formatDuration(getRunDurationMs(events)),
    status: status === "Running" ? "No final outcome" : status,
    metrics,
    milestones,
    emptyResult:
      result != null
        ? "Result recorded. Expand raw result data below to inspect it."
        : "No business result was attached to this run.",
    evidenceNote:
      candidates.length > 8
        ? `Latest 8 of ${candidates.length} milestones. Full event history is in Timeline.`
        : "Select a recorded milestone to inspect its payload.",
  }
}
