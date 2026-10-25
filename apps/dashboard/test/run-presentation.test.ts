import { describe, expect, it } from "vitest"
import {
  formatReportedProgress,
  getRunResultHighlights,
  latestReportedProgress,
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
})
