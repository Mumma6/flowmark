import { Result } from "effect"
import { decodeSuppliedSnapshot } from "../../dev-harness/app/evidence/supplied-snapshot"
import { describe, expect, it } from "vitest"
import { buildSuppliedRunSnapshot } from "../features/runs/investigation/supplied-run-snapshot"
import type { RouterOutputs } from "../features/platform/api-types"

type Summary = RouterOutputs["run"]["investigationSummary"]
type Page = RouterOutputs["run"]["eventPage"]
const summary: Summary = {
  id: "run-1",
  workflow: "customers.import",
  externalId: "PRIVATE_EXTERNAL",
  status: "Completed",
  startedAt: "2026-11-10T09:00:00Z",
  durationMs: 12000,
  step: null,
  outcome: "partial",
  environment: "PRIVATE_ENV",
  release: null,
  correlationId: "PRIVATE_CORRELATION",
  parentRunId: null,
  eventCount: 30,
  operationCount: 2,
  errorCount: 1,
  reportCount: 0,
}
const page: Page = {
  runId: "run-1",
  events: Array.from({ length: 10 }, (_, i) => ({
    id: `event-${i}`,
    type: "step",
    timestamp: "2026-11-10T09:00:01Z",
    properties: { private: "PRIVATE_PAYLOAD" },
    step: null,
    operationId: null,
    operationName: null,
    durationMs: null,
    completed: null,
    total: null,
    unit: null,
    reason: null,
    error: null,
    result: null,
    receivedAt: "2026-11-10T09:00:01Z",
    environment: null,
    release: null,
    correlationId: null,
    parentRunId: null,
    workflow: summary.workflow,
    externalId: summary.externalId,
  })),
  nextCursor: "PRIVATE_CURSOR",
  limit: 10,
  totalEvents: 30,
}

describe("bounded supplied evidence", () => {
  it("preserves canonical outcome and references even when the page contains no terminal event", () => {
    const value = buildSuppliedRunSnapshot("project-1", summary, page, true)!
    expect(
      Result.getOrThrow(decodeSuppliedSnapshot(JSON.stringify(value))),
    ).toEqual(value)
    expect(value.status).toBe("Completed")
    expect(value.duration).toBe("12.00 s")
    expect(value.milestones).toHaveLength(8)
    expect(value.milestones[0]?.id).toBe("event-0")
    expect(value.evidenceNote).toContain("Project reference: project-1")
    expect(value.evidenceNote).toContain("8 of 10")
    expect(value.evidenceNote).toContain("continuation page")
    expect(value.evidenceNote).toContain("More pages exist")
    expect(JSON.stringify(value)).not.toContain("PRIVATE_")
    expect(value.metrics).toEqual([])
    expect(value.emptyResult).toContain("withheld")
  })
  it("retains unknown and empty evidence without inventing activity or a result", () => {
    const value = buildSuppliedRunSnapshot(
      "project-1",
      { ...summary, status: "Running", durationMs: null },
      { ...page, events: [], nextCursor: null },
      false,
    )!
    expect(value.status).toBe("No final outcome")
    expect(value.duration).toBe("Not reported")
    expect(value.milestones).toEqual([])
    expect(value.evidenceNote).toContain("0 of 0")
    expect(value.evidenceNote).toContain("30 events recorded")
  })
  it("refuses a mismatched run page", () => {
    expect(
      buildSuppliedRunSnapshot(
        "project-1",
        summary,
        { ...page, runId: "other" },
        false,
      ),
    ).toBeNull()
  })
})
