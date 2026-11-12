import { Array, Match, Option, pipe } from "effect"
import type { RunSnapshotMilestone, RunSnapshotProps } from "@flowmark/ui"
import type { RunEvent } from "../../platform/api-types"
import { formatDuration, formatTimestamp } from "../../shared/format"
import { getRunDurationMs, getRunResultHighlights } from "./run-presentation"
import { terminalEvidence } from "./run-state"

const descriptions: Readonly<Record<string, string>> = {
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
  const { failure, completed, state: status } = terminalEvidence(events)
  const result = failure?.result ?? completed?.result
  const outcome = (failure ?? completed)?.outcome
  const lastProgress = Option.getOrUndefined(
    Array.findLast(events, (event) => event.type === "progress"),
  )
  const candidates = Array.filter(events, (event) =>
    event.type === "progress"
      ? event === lastProgress
      : ["step", "error", "completed", "failed"].includes(event.type),
  )
  const selected = Array.takeRight(
    candidates.length > 0 ? candidates : [first],
    8,
  )
  const milestones: RunSnapshotMilestone[] = Array.map(selected, (event) => {
    const kind = Match.value(event.type).pipe(
      Match.when("completed", () => "completed" as const),
      Match.when("failed", () => "failed" as const),
      Match.when("error", () => "error" as const),
      Match.when("progress", () => "progress" as const),
      Match.orElse(() => "checkpoint" as const),
    )
    const label = Match.value(event.type).pipe(
      Match.when("step", () => event.step ?? "Checkpoint"),
      Match.when("completed", () => "Reported result"),
      Match.when("failed", () => "Run failed"),
      Match.when("progress", () => "Progress reported"),
      Match.when("error", () => event.error?.code ?? "Error observed"),
      Match.orElse(() => "Run started"),
    )
    const payload = Match.value(event).pipe(
      Match.when(
        (value) => value.outcome != null,
        (value) => ({
          outcome: value.outcome,
          result: value.result,
          error: value.error,
        }),
      ),
      Match.when({ type: "progress" }, (value) => ({
        completed: value.completed,
        total: value.total,
        unit: value.unit,
      })),
      Match.orElse(
        (value) =>
          value.error ??
          value.result ??
          value.properties ?? { type: value.type },
      ),
    )
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
  const reportedMetrics = pipe(
    getRunResultHighlights(result ?? {}),
    Array.take(outcome == null ? 4 : 3),
    Array.map((item) => ({
      label: item.label,
      value: item.value,
      note: "Application-reported",
    })),
  )
  const primaryMetrics = [
    ...(outcome == null
      ? []
      : [
          {
            label: "Business outcome",
            value: outcome,
            note: "Explicit application report",
          },
        ]),
    ...reportedMetrics,
  ]
  const metrics =
    primaryMetrics.length > 0 && primaryMetrics.length < 4
      ? Array.append(primaryMetrics, {
          label: "Recorded events",
          value: String(events.length),
          note: "Persisted telemetry",
        })
      : primaryMetrics
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
