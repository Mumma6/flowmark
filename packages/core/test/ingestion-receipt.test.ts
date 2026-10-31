import { Schema } from "effect"
import { describe, expect, it } from "vitest"
import { IngestionReceiptSchema } from "../src/ingestion.js"

describe("ingestion receipt", () => {
  it("recognizes real older acknowledgments without inventing a disposition", () => {
    expect(
      Schema.decodeUnknownSync(IngestionReceiptSchema)({ accepted: true }),
    ).toEqual({ accepted: true })
  })
  it("keeps ignored telemetry distinct from accepted new evidence", () => {
    expect(
      Schema.is(IngestionReceiptSchema)({
        accepted: false,
        disposition: "ignored",
      }),
    ).toBe(true)
    expect(
      Schema.is(IngestionReceiptSchema)({
        accepted: true,
        disposition: "recorded",
      }),
    ).toBe(true)
    expect(
      Schema.is(IngestionReceiptSchema)({
        accepted: true,
        disposition: "duplicate",
      }),
    ).toBe(true)
    expect(
      Schema.is(IngestionReceiptSchema)({
        accepted: true,
        disposition: "ignored",
      }),
    ).toBe(false)
    expect(
      Schema.is(IngestionReceiptSchema)({
        accepted: false,
        disposition: "recorded",
      }),
    ).toBe(false)
  })
})
