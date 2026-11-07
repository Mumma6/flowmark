import { describe, expect, it } from "vitest"
import { Effect } from "effect"
import {
  decodeFindRunsInput,
  decodeListWorkflowsInput,
} from "../src/tools/schemas.js"
import { assertHistoryWindow } from "../src/tools/response.js"
import { McpToolInputError } from "../src/errors.js"

describe("MCP tool input schemas", () => {
  it("rejects list_workflows without projectId", async () => {
    const result = await Effect.runPromise(
      decodeListWorkflowsInput({}).pipe(Effect.flip),
    )
    expect(result).toBeInstanceOf(McpToolInputError)
  })

  it("accepts list_workflows with explicit projectId", async () => {
    const input = await Effect.runPromise(
      decodeListWorkflowsInput({
        projectId: "proj_abc",
        limit: 25,
      }),
    )
    expect(input.projectId).toBe("proj_abc")
    expect(input.limit).toBe(25)
  })

  it("rejects find_runs without a bounded time window", async () => {
    const result = await Effect.runPromise(
      decodeFindRunsInput({ projectId: "p1" }).pipe(Effect.flip),
    )
    expect(result).toBeInstanceOf(McpToolInputError)
  })

  it("rejects history windows wider than 31 days", async () => {
    const result = await Effect.runPromise(
      assertHistoryWindow(
        "2026-01-01T00:00:00.000Z",
        "2026-03-01T00:00:00.000Z",
      ).pipe(Effect.flip),
    )
    expect(result).toBeInstanceOf(McpToolInputError)
  })

  it("accepts a 7-day find_runs window", async () => {
    const input = await Effect.runPromise(
      decodeFindRunsInput({
        projectId: "p1",
        startedAfter: "2026-02-01T00:00:00.000Z",
        startedBefore: "2026-02-08T00:00:00.000Z",
      }),
    )
    await Effect.runPromise(
      assertHistoryWindow(input.startedAfter, input.startedBefore),
    )
    expect(input.projectId).toBe("p1")
  })
})
