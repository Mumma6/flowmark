import { describe, expect, it } from "vitest"
import {
  buildRunExport,
  buildTimelineExport,
  stringifyExport,
  type ExportableRunEvent,
} from "../app/run-export"

const base = {
  step: null,
  operationId: null,
  operationName: null,
  durationMs: null,
  completed: null,
  total: null,
  unit: null,
  reason: null,
  properties: null,
  error: null,
  result: null,
  receivedAt: "2026-10-26T20:16:11.000Z",
  workflow: "chat.load-messages",
  externalId: "run-1",
  environment: "production",
  release: null,
  correlationId: null,
  parentRunId: null,
} as const

function event(
  partial: Partial<ExportableRunEvent> &
    Pick<ExportableRunEvent, "id" | "type" | "timestamp">,
): ExportableRunEvent {
  return { ...base, ...partial }
}

describe("run export", () => {
  it("keeps received snapshots separate from final results even with skewed application timestamps", () => {
    const events = [
      event({
        id: "start",
        type: "started",
        timestamp: "2026-10-26T20:00:00Z",
      }),
      event({
        id: "latest",
        type: "report",
        timestamp: "2026-10-26T20:01:00Z",
        receiptOrder: 3,
        isLatestReport: true,
        result: { imported: 20 },
      }),
      event({
        id: "earlier",
        type: "report",
        timestamp: "2026-10-26T20:02:00Z",
        receiptOrder: 2,
        isLatestReport: false,
        result: { imported: 10, rejected: 2 },
      }),
      event({
        id: "final",
        type: "completed",
        timestamp: "2026-10-26T20:03:00Z",
      }),
    ]
    expect(buildRunExport(events)).toMatchObject({
      status: "Completed",
      result: null,
      lastReportedBusinessWork: { result: { imported: 20 } },
    })
    expect(
      buildTimelineExport(events)?.events.filter(
        (row) => row.type === "report",
      ),
    ).toHaveLength(2)
  })

  it("builds a stable run summary with context, result, and counts", () => {
    const events = [
      event({
        id: "1",
        type: "started",
        timestamp: "2026-10-26T20:16:09.000Z",
        properties: { roomId: "abc" },
      }),
      event({
        id: "2",
        type: "operation_started",
        timestamp: "2026-10-26T20:16:09.016Z",
        operationId: "op-1",
        operationName: "build-query",
      }),
      event({
        id: "3",
        type: "operation_completed",
        timestamp: "2026-10-26T20:16:09.034Z",
        operationId: "op-1",
        operationName: "build-query",
        durationMs: 18,
      }),
      event({
        id: "4",
        type: "operation_started",
        timestamp: "2026-10-26T20:16:09.035Z",
        operationId: "op-2",
        operationName: "query-firestore",
      }),
      event({
        id: "5",
        type: "operation_failed",
        timestamp: "2026-10-26T20:16:10.000Z",
        operationId: "op-2",
        operationName: "query-firestore",
        durationMs: 168,
        error: { code: "permission-denied" },
      }),
      event({
        id: "6",
        type: "failed",
        timestamp: "2026-10-26T20:16:10.000Z",
        error: { code: "LOAD_MESSAGES_FAILED" },
        result: { loaded: 0 },
      }),
    ]

    expect(buildRunExport(events)).toMatchObject({
      workflow: "chat.load-messages",
      externalId: "run-1",
      status: "Failed",
      context: { roomId: "abc" },
      result: { loaded: 0 },
      eventCount: 6,
      operationCount: 2,
      failedOperationCount: 1,
      errorCount: 0,
    })
  })

  it("exports the full ordered timeline for clipboard paste", () => {
    const events = [
      event({
        id: "1",
        type: "started",
        timestamp: "2026-10-26T20:16:09.000Z",
      }),
      event({
        id: "2",
        type: "failed",
        timestamp: "2026-10-26T20:16:10.000Z",
        error: { code: "LOAD_MESSAGES_FAILED" },
      }),
    ]
    const timeline = buildTimelineExport(events)
    expect(timeline?.events).toHaveLength(2)
    expect(timeline?.events[1]).toMatchObject({
      type: "failed",
      error: { code: "LOAD_MESSAGES_FAILED" },
    })
    expect(stringifyExport(timeline)).toContain('"type": "failed"')
  })

  it("returns null for an empty event list", () => {
    expect(buildRunExport([])).toBeNull()
    expect(buildTimelineExport([])).toBeNull()
  })
})
