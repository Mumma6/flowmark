type WorkflowAttempt = { readonly groupId: string; readonly number: number }

type AttemptEvent = {
  readonly id: string
  readonly type: string
  readonly timestamp: string
  readonly operationId?: string | null
  readonly operationName?: string | null
  readonly attempt?: WorkflowAttempt | null
  readonly durationMs?: number | null
}

/** Preserve occurrences, including terminal-only evidence. Never infer an attempt from a name. */
export function buildAttemptSequence(events: readonly AttemptEvent[]) {
  const operations = new Map<string, AttemptEvent[]>()
  for (const event of events) {
    if (!event.operationId || !event.attempt) {
      continue
    }
    const evidence = operations.get(event.operationId) ?? []
    operations.set(event.operationId, [...evidence, event])
  }
  return [...operations.entries()]
    .map(([operationId, evidence]) => {
      const first = [...evidence].sort(
        (a, b) =>
          a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id),
      )[0]!
      const terminal =
        evidence.find((event) => event.type === "operation_failed") ??
        evidence.find((event) => event.type === "operation_completed")
      return {
        operationId,
        name: first.operationName ?? "Operation",
        groupId: first.attempt!.groupId,
        number: first.attempt!.number,
        timestamp: first.timestamp,
        durationMs: terminal?.durationMs ?? null,
        status:
          terminal?.type === "operation_failed"
            ? "failed"
            : terminal
              ? "completed"
              : "No terminal evidence",
        hasStart: evidence.some((event) => event.type === "operation_started"),
        eventId: terminal?.id ?? first.id,
      }
    })
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name) ||
        a.groupId.localeCompare(b.groupId) ||
        a.number - b.number ||
        a.operationId.localeCompare(b.operationId),
    )
}
