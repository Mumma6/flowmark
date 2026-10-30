import { Schema } from "effect"
import { describe, expect, it } from "vitest"
import {
  ResultDeclarationSchema,
  WorkflowEventSchema,
  WorkflowOutcomeSchema,
} from "../src/index.js"

describe("business outcome contract", () => {
  it.each(["complete", "partial", "no-availability", "a".repeat(64)])(
    "accepts bounded code %s",
    (code) => expect(Schema.is(WorkflowOutcomeSchema)(code)).toBe(true),
  )
  it.each(["", " ", "Partial", "bad code", "a".repeat(65), null, 1])(
    "rejects invalid code %j",
    (code) => expect(Schema.is(WorkflowOutcomeSchema)(code)).toBe(false),
  )
  it.each(["completed", "failed"])(
    "validates %s independently of result",
    (type) => {
      const event = {
        type,
        workflow: "import",
        runId: "synthetic",
        timestamp: "2026-10-30T09:00:00Z",
      }
      expect(
        Schema.is(WorkflowEventSchema)({ ...event, outcome: "partial" }),
      ).toBe(true)
      expect(
        Schema.is(WorkflowEventSchema)({
          ...event,
          result: { outcome: "custom-result-value" },
        }),
      ).toBe(true)
      expect(
        Schema.is(WorkflowEventSchema)({
          ...event,
          outcome: "INVALID",
          result: {},
        }),
      ).toBe(false)
    },
  )
  it("bounds declaration depth and field count", () => {
    const field = {
      path: ["counts", "imported"],
      label: "Imported",
      kind: "count",
      unit: "rows",
    }
    expect(
      Schema.is(ResultDeclarationSchema)({ revision: "v1", fields: [field] }),
    ).toBe(true)
    expect(
      Schema.is(ResultDeclarationSchema)({
        revision: "v1",
        fields: Array.from({ length: 13 }, () => field),
      }),
    ).toBe(false)
    expect(
      Schema.is(ResultDeclarationSchema)({
        revision: "v1",
        fields: [{ ...field, path: Array(6).fill("a") }],
      }),
    ).toBe(false)
    expect(
      Schema.is(ResultDeclarationSchema)({
        revision: "v1",
        fields: [{ ...field, label: " " }],
      }),
    ).toBe(false)
  })
  it("rejects duplicate declared field paths", () => {
    const field = { path: ["imported"], label: "Imported", kind: "count" }
    expect(
      Schema.is(ResultDeclarationSchema)({
        revision: "v1",
        fields: [field, field],
      }),
    ).toBe(false)
  })
})
