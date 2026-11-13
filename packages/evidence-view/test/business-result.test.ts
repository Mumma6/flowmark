import { expect, it } from "vitest"
import { Result } from "effect"
import { decodeToolEvidence, projectToolEvidence } from "../src/tool-result.js"
const args = { projectId: "project", runId: "run", section: "events" }
const evidence = {
  projection: {
    version: 1,
    depth: "business",
    projectId: "project",
    publicationRevision: 2,
    observedAt: "2026-11-13T00:00:00.000Z",
    withheld: ["errors"],
  },
  data: {
    kind: "run",
    summary: {
      id: "run",
      workflow: "orders",
      status: "Completed",
      outcome: "accepted",
      startedAt: "2026-11-13T00:00:00.000Z",
      durationMs: 25,
    },
    fields: [
      {
        revision: "v1",
        path: ["accepted"],
        label: "Accepted",
        unit: null,
        kind: "count",
        state: "available",
        value: 3,
      },
    ],
    references: [{ key: "customer", value: "customer-1" }],
  },
}
const envelope = {
  structuredContent: { tool: "get_run", projectId: "project", evidence },
  content: [{ type: "text", text: "Complete projected JSON" }],
}
it("decodes a supplied business view without constructing a diagnostic snapshot", () => {
  const result = decodeToolEvidence(args, envelope)
  expect(Result.isSuccess(result)).toBe(true)
  if (Result.isSuccess(result)) {
    expect(result.success.kind).toBe("business")
    expect(result.success).not.toHaveProperty("snapshot")
    expect(result.success.nextCursor).toBeNull()
  }
  expect(Result.isFailure(projectToolEvidence(args, envelope))).toBe(true)
})
it("rejects foreign, failed, stale cursor and oversized results", () => {
  expect(
    Result.isFailure(
      decodeToolEvidence({ ...args, projectId: "foreign" }, envelope),
    ),
  ).toBe(true)
  expect(
    Result.isFailure(
      decodeToolEvidence({ ...args, cursor: "raw-cursor" }, envelope),
    ),
  ).toBe(true)
  expect(
    Result.isFailure(decodeToolEvidence(args, { ...envelope, isError: true })),
  ).toBe(true)
  expect(
    Result.isFailure(
      decodeToolEvidence(args, { ...envelope, padding: "x".repeat(65536) }),
    ),
  ).toBe(true)
})
it("does not pass extra diagnostic siblings into the supplied renderer", () => {
  const result = decodeToolEvidence(args, {
    structuredContent: {
      ...envelope.structuredContent,
      evidence: {
        ...evidence,
        data: {
          ...evidence.data,
          properties: { secret: "PRIVATE_CANARY" },
          error: { message: "PRIVATE_CANARY" },
        },
      },
    },
  })
  expect(Result.isSuccess(result)).toBe(true)
  expect(JSON.stringify(result)).not.toContain("PRIVATE_CANARY")
})
