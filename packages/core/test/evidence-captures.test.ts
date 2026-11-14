import { describe, expect, it } from "vitest"
import { Array, Result, Schema } from "effect"
import {
  CaptureRunSchema,
  CapturedRunEvidenceSchema,
  captureCoverage,
} from "../src/evidence-captures.js"
const projectId = "11111111-1111-4111-8111-111111111111",
  runId = "22222222-2222-4222-8222-222222222222"
const capture = {
  version: 1,
  id: "33333333-3333-4333-8333-333333333333",
  creatorId: "synthetic",
  projectId,
  sourceRunId: runId,
  title: "Observation",
  capturedAt: "2026-11-13T10:00:00.000Z",
  expiresAt: "2026-11-14T10:00:00.000Z",
  coverage: captureCoverage,
  evidence: {
    projection: {
      version: 1,
      depth: "business",
      projectId,
      publicationRevision: 1,
      observedAt: "2026-11-13T10:00:00.000Z",
      withheld: ["rawEvents"],
    },
    data: {
      kind: "run",
      summary: {
        id: runId,
        workflow: "orders",
        status: "Completed",
        outcome: "accepted",
        startedAt: "2026-11-13T09:00:00.000Z",
        durationMs: 1000,
      },
      fields: [],
      references: [],
    },
  },
}
const decode = Schema.decodeUnknownResult(CapturedRunEvidenceSchema, {
  onExcessProperty: "error",
})
describe("captured business evidence contract", () => {
  it("admits a bounded observation and a source-only command", () => {
    expect(Result.isSuccess(decode(capture))).toBe(true)
    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(CaptureRunSchema)({
          runId,
          title: "Observation",
        }),
      ),
    ).toBe(true)
  })
  it("rejects raw nested fields, mismatched identities and renewed lifetimes", () => {
    expect(
      Result.isFailure(
        decode({
          ...capture,
          evidence: {
            ...capture.evidence,
            data: {
              ...capture.evidence.data,
              rawEvents: [{ secret: "canary" }],
            },
          },
        }),
      ),
    ).toBe(true)
    expect(
      Result.isFailure(decode({ ...capture, sourceRunId: projectId })),
    ).toBe(true)
    expect(
      Result.isFailure(
        decode({ ...capture, expiresAt: "2026-11-14T10:00:00.001Z" }),
      ),
    ).toBe(true)
    expect(
      Result.isFailure(
        decode({
          ...capture,
          evidence: {
            ...capture.evidence,
            projection: {
              ...capture.evidence.projection,
              observedAt: "2026-11-13T11:00:00.000Z",
            },
          },
        }),
      ),
    ).toBe(true)
  })
  it("counts UTF-8 bytes across the entire persisted envelope", () => {
    const fields = Array.map(Array.range(1, 12), () => ({
      revision: "v1",
      path: Array.map(Array.range(1, 5), () => "😀".repeat(60)),
      label: "Label",
      unit: null,
      kind: "reasons",
      state: "available",
      value: Array.map(Array.range(1, 20), () => ({
        value: "😀".repeat(60),
        count: 1,
      })),
    }))
    expect(
      Result.isFailure(
        decode({
          ...capture,
          evidence: {
            ...capture.evidence,
            data: { ...capture.evidence.data, fields },
          },
        }),
      ),
    ).toBe(true)
  })
})
