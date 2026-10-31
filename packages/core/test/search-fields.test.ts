import { Schema } from "effect"
import { describe, expect, it } from "vitest"
import { SearchFieldsSchema } from "../src/search-fields.js"

describe("explicit business search declarations", () => {
  it("accepts bounded explicit lookup and category roles, including disabling all keys", () => {
    expect(Schema.is(SearchFieldsSchema)([])).toBe(true)
    expect(
      Schema.is(SearchFieldsSchema)([
        { key: "batchId", role: "lookup" },
        { key: "provider", role: "dimension", values: ["crm-a", "crm-b"] },
      ]),
    ).toBe(true)
  })
  it("rejects unsafe keys, duplicate keys and unbounded category definitions", () => {
    for (const fields of [
      [{ key: "nested.path", role: "lookup" }],
      [{ key: "__proto__", role: "lookup" }],
      [
        { key: "a", role: "lookup" },
        { key: "a", role: "lookup" },
      ],
      [{ key: "provider", role: "dimension", values: [] }],
      [{ key: "provider", role: "dimension", values: ["a", "a"] }],
      [{ key: "provider", role: "dimension", values: ["x".repeat(257)] }],
      Array.from({ length: 9 }, (_, i) => ({ key: `key${i}`, role: "lookup" })),
    ]) {
      expect(Schema.is(SearchFieldsSchema)(fields)).toBe(false)
    }
  })
})
