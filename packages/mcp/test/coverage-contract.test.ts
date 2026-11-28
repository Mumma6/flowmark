import { Schema } from "effect"
import { describe, expect, it } from "vitest"
import { AssessCoverageSchema } from "../src/features/workflows/assess-coverage.js"

const input = {
  version: 2,
  projectId: "00000000-0000-4000-8000-000000000001",
  questionId: "payment.confirmation",
  questionRevision: 1,
  release: `sha256:${"a".repeat(64)}`,
  behaviorRevision: "1",
  environment: "production",
  provenance: "fixture",
  populationSource: null,
  window: {
    start: "2026-11-01T00:00:00.000Z",
    end: "2026-11-02T00:00:00.000Z",
  },
  maturityDelayMs: 0,
  observedAt: "2026-11-02T00:00:00.000Z",
  supportExpiresAt: null,
  sampling: "complete",
  join: "case-handle",
  drilldownLimit: 8,
  permittedHandles: [],
  population: [],
}
const decode = Schema.decodeUnknownSync(AssessCoverageSchema, {
  onExcessProperty: "error",
})

describe("stored coverage contract", () => {
  it("accepts an independent population without caller verdicts", () => {
    expect(decode(input).version).toBe(2)
  })
  it.each([
    { version: 1 },
    { deliveries: [] },
    { discovery: "matched" },
    { readiness: "verified" },
    { stored: [] },
    { storedTruncated: false },
  ])("rejects unsupported or caller-manufactured evidence %j", (claims) => {
    expect(() => decode({ ...input, ...claims })).toThrow()
  })
})
