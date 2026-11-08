import { describe, expect, it } from "vitest"
import { Result } from "effect"
import {
  decodeRunInvestigationSelection,
  runSelectionToolInput,
} from "../src/investigation-selection.js"

const selection = {
  version: 1,
  kind: "run",
  projectId: "11111111-1111-1111-1111-111111111111",
  runId: "22222222-2222-2222-2222-222222222222",
  section: "events",
}
describe("versioned run selection", () => {
  it("round-trips a precise run and evidence page without authority", () => {
    const decoded = Result.getOrThrow(
      decodeRunInvestigationSelection(
        JSON.parse(
          JSON.stringify({
            ...selection,
            limit: 7,
            cursor: "2026-11-08T10:00:00.123456Z|evidence",
          }),
        ),
      ),
    )
    expect(Result.getOrThrow(runSelectionToolInput(decoded))).toEqual({
      projectId: selection.projectId,
      runId: selection.runId,
      section: "events",
      limit: 7,
      cursor: "2026-11-08T10:00:00.123456Z|evidence",
    })
  })
  it.each([
    { version: 2 },
    { kind: "cohort" },
    { section: "compare" },
    { revision: "v2" },
    { authorization: "not-authority" },
    { limit: 0 },
    { runId: "external-sdk-reference" },
  ])("rejects unsupported or malformed selection %j", (change) => {
    expect(
      Result.isFailure(
        decodeRunInvestigationSelection({ ...selection, ...change }),
      ),
    ).toBe(true)
  })
})
