import { describe, expect, it } from "vitest"
import {
  buildOperationSpans,
  buildProgressSeries,
  formatReportedProgress,
  getRunResultHighlights,
  latestReportedProgress,
  operationIdleGaps,
  runStatusLabel,
} from "../app/run-presentation"

describe("run presentation", () => {
  it("describes a run without terminal evidence without claiming it is active", () => {
    expect(runStatusLabel("Running")).toBe("No final outcome")
    expect(runStatusLabel("Completed")).toBe("Completed")
    expect(runStatusLabel("Failed")).toBe("Failed")
  })

  it("shows the latest progress observation, not a calculated live state", () => {
    const progress = latestReportedProgress([
      { type: "progress", completed: 40, total: 100, unit: "records" },
      { type: "step" },
      { type: "progress", completed: 62, total: 100, unit: "records" },
    ])

    expect(progress).toEqual({
      completed: 62,
      total: 100,
      unit: "records",
    })
    expect(progress && formatReportedProgress(progress)).toBe(
      "62 / 100 records",
    )
    expect(latestReportedProgress([{ type: "step" }])).toBeUndefined()
  })

  it("turns a few reported scalar result fields into readable highlights", () => {
    expect(
      getRunResultHighlights({
        total: 1000,
        imported: 988,
        skipped_records: 12,
        sourceName: "legacy",
        details: { errors: 3 },
      }),
    ).toEqual([
      { key: "total", label: "Total", value: "1000" },
      { key: "imported", label: "Imported", value: "988" },
      { key: "skipped_records", label: "Skipped Records", value: "12" },
      { key: "sourceName", label: "Source Name", value: "legacy" },
    ])
  })

  it("ignores non-scalar fields and preserves boolean values", () => {
    expect(
      getRunResultHighlights({
        partial: true,
        absent: null,
        records: [1, 2],
      }),
    ).toEqual([{ key: "partial", label: "Partial", value: "true" }])
  })

  it("pairs operations into spans with overlap-friendly offsets", () => {
    const spans = buildOperationSpans([
      { type: "started", timestamp: "2026-10-26T20:00:00.000Z" },
      {
        type: "operation_started",
        timestamp: "2026-10-26T20:00:00.010Z",
        operationId: "a",
        operationName: "build-query",
      },
      {
        type: "operation_completed",
        timestamp: "2026-10-26T20:00:00.028Z",
        operationId: "a",
        operationName: "build-query",
        durationMs: 18,
      },
      {
        type: "operation_started",
        timestamp: "2026-10-26T20:00:00.030Z",
        operationId: "b",
        operationName: "query-firestore",
      },
      {
        type: "operation_failed",
        timestamp: "2026-10-26T20:00:00.198Z",
        operationId: "b",
        operationName: "query-firestore",
        durationMs: 168,
        error: { code: "permission-denied" },
      },
    ])
    expect(spans).toHaveLength(2)
    expect(spans[0]).toMatchObject({
      name: "build-query",
      status: "completed",
      durationMs: 18,
      offsetMs: 10,
    })
    expect(spans[1]).toMatchObject({
      name: "query-firestore",
      status: "failed",
      durationMs: 168,
    })
    expect(operationIdleGaps(spans)[0]?.idleMs).toBe(2)
  })

  it("builds a chronological progress series from absolute snapshots", () => {
    expect(
      buildProgressSeries([
        { type: "started", timestamp: "2026-10-26T20:00:00.000Z" },
        {
          type: "progress",
          timestamp: "2026-10-26T20:00:01.000Z",
          completed: 40,
          total: 100,
          unit: "rows",
        },
        {
          type: "progress",
          timestamp: "2026-10-26T20:00:02.000Z",
          completed: 80,
          total: 100,
          unit: "rows",
        },
      ]),
    ).toEqual([
      {
        timestamp: "2026-10-26T20:00:01.000Z",
        offsetMs: 1000,
        completed: 40,
        total: 100,
        unit: "rows",
      },
      {
        timestamp: "2026-10-26T20:00:02.000Z",
        offsetMs: 2000,
        completed: 80,
        total: 100,
        unit: "rows",
      },
    ])
  })
})
