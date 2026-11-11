import { describe, expect, it } from "vitest"
import * as Result from "effect/Result"
import { decodeToolEvidence, projectToolEvidence } from "../src/tool-result.js"
import { buildSuppliedRunSnapshot } from "../src/projection.js"

import { args, structured, result } from "./fixtures.js"

describe("MCP supplied evidence boundary", () => {
  it("reuses Studio's projection without forwarding payload fields or inferring outcome from a partial page", () => {
    const snapshot = Result.getOrThrow(projectToolEvidence(args, result))
    expect(snapshot).toEqual(
      buildSuppliedRunSnapshot(
        args.projectId,
        structured.summary,
        structured.page,
        false,
      ),
    )
    expect(snapshot.status).toBe("Completed")
    expect(snapshot.evidenceNote).toContain("20 events")
    expect(JSON.stringify(snapshot)).not.toContain("WITHHELD_CANARY")
  })
  it("rejects scope mismatches, missing invocation, unsupported sections and failed results", () => {
    const invalid = [
      projectToolEvidence(undefined, result),
      projectToolEvidence({ ...args, projectId: "foreign" }, result),
      projectToolEvidence({ ...args, runId: "foreign" }, result),
      projectToolEvidence(args, { ...result, isError: true }),
      projectToolEvidence(args, {
        ...result,
        structuredContent: { ...structured, section: "operations" },
      }),
      projectToolEvidence(args, {
        ...result,
        structuredContent: {
          ...structured,
          page: { ...structured.page, runId: "foreign" },
        },
      }),
    ]
    expect(invalid.every(Result.isFailure)).toBe(true)
  })
  it("rejects malformed coverage, more than 100 events and oversized RPC results", () => {
    expect(
      Result.isFailure(
        projectToolEvidence(args, {
          ...result,
          structuredContent: {
            ...structured,
            page: { ...structured.page, totalEvents: 0 },
          },
        }),
      ),
    ).toBe(true)
    expect(
      Result.isFailure(
        projectToolEvidence(args, {
          ...result,
          content: [{ type: "text", text: "x".repeat(65536) }],
        }),
      ),
    ).toBe(true)
    expect(
      Result.isFailure(
        projectToolEvidence(args, {
          ...result,
          structuredContent: {
            ...structured,
            page: { ...structured.page, limit: 101 },
          },
        }),
      ),
    ).toBe(true)
  })
  it("renders hostile strings as supplied text data and preserves continuation coverage", () => {
    const snapshot = Result.getOrThrow(
      projectToolEvidence(
        { ...args, cursor: "previous" },
        {
          ...result,
          structuredContent: {
            ...structured,
            summary: {
              ...structured.summary,
              workflow: "<img src=x onerror=alert(1)>",
            },
          },
        },
      ),
    )
    expect(snapshot.workflow).toContain("<img")
    expect(snapshot.evidenceNote).toContain("continuation")
  })
})

it("rejects widened page limits and non-advancing cursors before enabling navigation", () => {
  expect(
    Result.isFailure(projectToolEvidence({ ...args, limit: 10 }, result)),
  ).toBe(true)
  expect(
    Result.isFailure(projectToolEvidence({ ...args, cursor: "next" }, result)),
  ).toBe(true)
})

it("keeps response-budget reductions instead of widening the next request", () => {
  const page = Result.getOrThrow(
    decodeToolEvidence({ ...args, limit: 100 }, result),
  )
  expect(page.invocation.limit).toBe(50)
})
