import { Result } from "effect"
import { describe, expect, it } from "vitest"
import {
  decodeSuppliedSnapshot,
  exampleSnapshot,
} from "../app/evidence/supplied-snapshot"

const decode = (value: unknown) => decodeSuppliedSnapshot(JSON.stringify(value))
describe("supplied snapshot trust boundary", () => {
  it("round trips supplied meaning and references without a network or credential boundary", () => {
    expect(Result.getOrThrow(decode(exampleSnapshot))).toEqual(exampleSnapshot)
  })
  it("preserves long values, omissions and an empty event page", () => {
    const supplied = {
      ...exampleSnapshot,
      workflow: "long".repeat(1000),
      milestones: [],
    }
    expect(Result.getOrThrow(decode(supplied))).toEqual(supplied)
  })
  it("rejects malformed or oversized JSON instead of retaining previous evidence", () => {
    expect(Result.isFailure(decodeSuppliedSnapshot("{"))).toBe(true)
    expect(Result.isFailure(decodeSuppliedSnapshot(" ".repeat(65537)))).toBe(
      true,
    )
    expect(
      Result.isFailure(
        decode({ ...exampleSnapshot, workflow: "a".repeat(8193) }),
      ),
    ).toBe(true)
  })
  it("rejects actions, credential fields, missing coverage, duplicate references and unbounded collections", () => {
    const invalid = [
      { ...exampleSnapshot, actions: "<script>" },
      { ...exampleSnapshot, apiKey: "must-not-be-accepted" },
      { ...exampleSnapshot, evidenceNote: undefined },
      {
        ...exampleSnapshot,
        milestones: [
          exampleSnapshot.milestones[0],
          exampleSnapshot.milestones[0],
        ],
      },
      {
        ...exampleSnapshot,
        milestones: Array.from({ length: 9 }, (_, i) => ({
          ...exampleSnapshot.milestones[0],
          id: String(i),
        })),
      },
      { ...exampleSnapshot, status: "Running" },
    ]
    expect(invalid.map((value) => Result.isFailure(decode(value)))).toEqual(
      invalid.map(() => true),
    )
  })
})
