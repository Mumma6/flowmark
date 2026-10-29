import { describe, expect, it } from "vitest"
import { buildRunSnapshot } from "../app/run-snapshot-presentation"
import type { RunEvent } from "../app/run-event-table"

function event(
  id: string,
  type: RunEvent["type"],
  partial: Partial<RunEvent> = {},
): RunEvent {
  return {
    id,
    type,
    timestamp: "2026-10-29T14:32:00.000Z",
    workflow: "customers.import",
    externalId: "IMP-2049",
    ...partial,
  } as RunEvent
}

describe("shared run snapshot projection", () => {
  it("preserves completion separately from skipped records and handled errors", () => {
    const snapshot = buildRunSnapshot([
      event("1", "started"),
      event("2", "error", { error: { code: "CRM_RATE_LIMIT", handled: true } }),
      event("3", "completed", {
        timestamp: "2026-10-29T14:32:08.400Z",
        result: { imported: 988, skipped: 12 },
      }),
    ])!
    expect(snapshot.status).toBe("Completed")
    expect(snapshot.duration).toBe("8.40 s")
    expect(snapshot.metrics).toContainEqual({
      label: "Skipped",
      value: "12",
      note: "Application-reported",
    })
    expect(snapshot.milestones[0]?.payload).toContain('"handled": true')
    expect(snapshot.milestones.at(-1)?.kind).toBe("completed")
  })

  it("does not infer activity, duration, or business success without terminal telemetry", () => {
    const snapshot = buildRunSnapshot([
      event("1", "started"),
      event("2", "progress", { completed: 600, total: 988, unit: "records" }),
    ])!
    expect(snapshot.status).toBe("No final outcome")
    expect(snapshot.duration).toBe("Not reported")
    expect(snapshot.metrics).toEqual([])
    expect(snapshot.milestones[0]?.progress).toEqual({
      completed: 600,
      total: 988,
      unit: "records",
    })
  })

  it("keeps a failed run and its partial result visible", () => {
    const snapshot = buildRunSnapshot([
      event("1", "started"),
      event("2", "failed", {
        error: { code: "CRM_FAILED" },
        result: { imported: 600 },
      }),
    ])!
    expect(snapshot.status).toBe("Failed")
    expect(snapshot.metrics[0]?.value).toBe("600")
    expect(snapshot.milestones[0]?.payload).toContain("CRM_FAILED")
    expect(snapshot.milestones[0]?.kind).toBe("failed")
  })

  it("bounds the summary while retaining terminal evidence and disclosing the full timeline", () => {
    const snapshot = buildRunSnapshot([
      event("start", "started"),
      ...Array.from({ length: 12 }, (_, i) =>
        event(`step-${i}`, "step", { step: `Checkpoint ${i}` }),
      ),
      event("final", "completed", { result: {} }),
    ])!
    expect(snapshot.milestones).toHaveLength(8)
    expect(snapshot.milestones.at(-1)?.id).toBe("final")
    expect(snapshot.evidenceNote).toContain("8 of 13")
    expect(snapshot.emptyResult).toContain("raw result data")
  })

  it("supports empty and start-only recordings", () => {
    expect(buildRunSnapshot([])).toBeNull()
    const snapshot = buildRunSnapshot([event("1", "started")])!
    expect(snapshot.milestones[0]?.label).toBe("Run started")
    expect(snapshot.status).toBe("No final outcome")
  })

  it("keeps only the latest progress snapshot in the summary without dropping checkpoints", () => {
    const snapshot = buildRunSnapshot([
      event("start", "started"),
      event("source", "step", { step: "Source loaded" }),
      event("progress-1", "progress", { completed: 200, total: 1000 }),
      event("progress-2", "progress", { completed: 600, total: 1000 }),
      event("final", "completed", { result: { imported: 600 } }),
    ])!
    expect(snapshot.milestones.map((item) => item.id)).toEqual([
      "source",
      "progress-2",
      "final",
    ])
    expect(snapshot.milestones[1]?.progress?.completed).toBe(600)
  })
})
