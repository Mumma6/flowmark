import { describe, expect, it } from "vitest"
import { Result, Option } from "effect"
import { decodeDefinitionDocument } from "../features/results/definitions/definition-document"
import {
  searchFieldOwnerLabel,
  searchFieldSource,
} from "../features/results/definitions/metadata-source"

describe("definition review trust boundary", () => {
  it("decodes metadata without accepting hidden ownership or apply commands", () => {
    const input = {
      version: 1,
      source: "booking-app",
      workflow: "booking.create",
      searchFields: [{ key: "bookingRef", role: "lookup" }],
    }
    expect(
      Result.isSuccess(decodeDefinitionDocument(JSON.stringify(input))),
    ).toBe(true)
    expect(
      Result.isFailure(
        decodeDefinitionDocument(JSON.stringify({ ...input, overwrite: true })),
      ),
    ).toBe(true)
    expect(
      Result.isFailure(
        decodeDefinitionDocument(
          JSON.stringify({
            ...input,
            searchFields: [{ ...input.searchFields[0], source: "take-over" }],
          }),
        ),
      ),
    ).toBe(true)
    expect(Result.isFailure(decodeDefinitionDocument("not-json"))).toBe(true)
  })
  it("does not mistake inherited object properties for code ownership", () => {
    expect(searchFieldOwnerLabel({}, "constructor")).toBe("Studio")
    expect(Option.isNone(searchFieldSource({}, "toString"))).toBe(true)
    expect(
      searchFieldOwnerLabel({ constructor: "booking-app" }, "constructor"),
    ).toBe("Code: booking-app")
  })
})
