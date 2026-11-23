import { Schema } from "effect"
import { describe, expect, it } from "vitest"
import question from "../../../examples/questions/committed-receipt.json"
import {
  isRuntimeQuestionSuccessor,
  RuntimeQuestionSchema,
} from "../src/runtime-question.js"

const decode = Schema.decodeUnknownSync(RuntimeQuestionSchema, {
  onExcessProperty: "error",
})

describe("repository-owned runtime questions", () => {
  it("requires a new revision for a different consequence, reference policy or exclusion", () => {
    const original = decode(question)
    expect(isRuntimeQuestionSuccessor(original, decode({ ...question }))).toBe(
      true,
    )
    for (const change of [
      { choices: ["Retry", "Stop"] },
      { changeNamespace: "different" },
      { excludedReason: "retired" },
    ]) {
      expect(
        isRuntimeQuestionSuccessor(
          original,
          decode({ ...question, ...change }),
        ),
      ).toBe(false)
      expect(
        isRuntimeQuestionSuccessor(
          original,
          decode({ ...question, ...change, revision: 2 }),
        ),
      ).toBe(true)
    }
  })
  it("keeps versioned meaning separate from source location and fixture instances", () => {
    expect(decode(question)).toEqual(question)
    expect(() =>
      decode({ ...question, requestProbe: question.committedReceiptProbe }),
    ).toThrow()
    expect(() =>
      decode({ ...question, choices: ["retry", " retry "] }),
    ).toThrow()
  })

  it.each([
    { predicate: "any-expression" },
    { scope: { ...question.scope, projectKey: "disallowed" } },
    { fields: ["customerEmail"] },
    { version: 2 },
    { changeNamespace: "request body" },
    { maturity: "whenever" },
  ])("rejects unsupported semantics or fields", (override) => {
    expect(() => decode({ ...question, ...override })).toThrow()
  })
})
