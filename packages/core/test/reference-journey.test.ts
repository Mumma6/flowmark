import { describe, expect, it } from "vitest"
import { Schema, Result } from "effect"
import { ReferenceJourneyQuerySchema } from "../src/reference-journey.js"

const query = {
  workflow: "patient.match",
  key: "referralRef",
  value: "SYN-REF-1",
  namespaces: [
    { workflow: "patient.match", key: "referralRef" },
    { workflow: "appointment.book", key: "referralRef" },
  ],
}
const decode = (value: unknown) =>
  Schema.decodeUnknownResult(ReferenceJourneyQuerySchema)(value, {
    onExcessProperty: "error",
  })
describe("qualified reference journey selection", () => {
  it("requires an explicit workflow/field mapping containing the anchor namespace", () => {
    expect(Result.isSuccess(decode(query))).toBe(true)
    expect(Result.isFailure(decode({ ...query, namespaces: [] }))).toBe(true)
    expect(
      Result.isFailure(
        decode({
          ...query,
          namespaces: [{ workflow: "appointment.book", key: "referralRef" }],
        }),
      ),
    ).toBe(true)
    expect(
      Result.isFailure(
        decode({
          ...query,
          namespaces: [query.namespaces[0], query.namespaces[0]],
        }),
      ),
    ).toBe(true)
  })
  it("rejects unbounded pages, unsupported filters and invalid run identities", () => {
    expect(Result.isFailure(decode({ ...query, limit: 51 }))).toBe(true)
    expect(Result.isFailure(decode({ ...query, environment: "prod" }))).toBe(
      true,
    )
    expect(
      Result.isFailure(decode({ ...query, anchorRunId: "external-run-name" })),
    ).toBe(true)
  })
})
