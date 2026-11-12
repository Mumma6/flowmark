export const args = {
  projectId: "synthetic-project",
  runId: "synthetic-run",
  section: "events",
}
export const structured = {
  tool: "get_run",
  ...args,
  summary: {
    id: args.runId,
    workflow: "synthetic.import",
    startedAt: "2026-11-10T09:00:00Z",
    durationMs: 1200,
    status: "Completed" as const,
  },
  page: {
    runId: args.runId,
    limit: 50,
    totalEvents: 20,
    nextCursor: "next",
    events: [
      {
        id: "synthetic-event",
        type: "progress",
        timestamp: "2026-11-10T09:00:01Z",
        properties: { secret: "WITHHELD_CANARY" },
      },
    ],
  },
}
export const result = {
  structuredContent: structured,
  content: [{ type: "text" as const, text: JSON.stringify(structured) }],
}
