import { describe, expect, it } from "vitest"
import { Result, Schema } from "effect"
import { WorkflowPropertiesSchema } from "../src/json.js"

const accepted = (value: unknown) =>
  Result.isSuccess(Schema.decodeUnknownResult(WorkflowPropertiesSchema)(value))

describe("bounded JSON immutable traversal", () => {
  it("admits shared references and dense large arrays without treating sharing as a cycle", () => {
    const shared = Object.freeze({ count: 0, enabled: false })
    expect(accepted(Object.freeze({ left: shared, right: shared }))).toBe(true)
    expect(accepted({ values: Array.from({ length: 8000 }, () => 0) })).toBe(
      true,
    )
    expect(accepted({ values: [] })).toBe(true)
    expect(accepted(Object.create(null))).toBe(true)
  })
  it("rejects cycles, sparse arrays and non-JSON values", () => {
    const cycle: Record<string, unknown> = {}
    cycle.self = cycle
    ;[
      cycle,
      { values: new Array(1000000) },
      { value: new Date() },
      { value: Object.create({ custom: true }) },
      { value: NaN },
      { value: Infinity },
      { value: undefined },
      { value: 1n },
    ].forEach((value) => expect(accepted(value)).toBe(false))
  })
  it("contains exceptional nested getters at the validation boundary", () => {
    const getter = () => {
      throw new Error("unreadable value")
    }
    const values = new Array(2)
    Object.defineProperty(values, "1", { get: getter })
    expect(accepted({ values })).toBe(false)
  })
  it("counts keys across nested siblings and keeps UTF-16 and UTF-8 limits separate", () => {
    expect(
      accepted(
        Object.fromEntries(
          Array.from({ length: 128 }, (_, i) => [String(i), 0]),
        ),
      ),
    ).toBe(true)
    expect(
      accepted(
        Object.fromEntries(
          Array.from({ length: 129 }, (_, i) => [String(i), 0]),
        ),
      ),
    ).toBe(false)
    expect(accepted({ text: "😀".repeat(1024) })).toBe(true)
    expect(accepted({ text: "😀".repeat(1025) })).toBe(false)
    expect(
      accepted(
        Object.fromEntries(
          Array.from({ length: 5 }, (_, i) => [String(i), "é".repeat(2048)]),
        ),
      ),
    ).toBe(false)
    expect(accepted({ a: { b: { c: { d: { e: 0 } } } } })).toBe(true)
    expect(accepted({ a: { b: { c: { d: { e: { f: 0 } } } } } })).toBe(false)
  })
})

it("never evaluates user-defined hashing protocols while validating JSON", () => {
  const values = [0]
  Object.defineProperty(values, "~effect/Hash", {
    get: () => {
      throw new Error("Untrusted hashing protocol")
    },
  })
  expect(accepted({ values })).toBe(true)
})
