import { expect, it } from "vitest"
import {
  awaitingFirstRunDetail,
  verifyFirstRunEvidence,
} from "../features/connect/first-run-evidence"

it("returns awaiting when no runs are authorized for the project", () => {
  expect(verifyFirstRunEvidence([], false)).toEqual({ kind: "awaiting" })
  expect(awaitingFirstRunDetail()).toContain("does not prove telemetry")
})

it("links verification to a persisted run id", () => {
  expect(
    verifyFirstRunEvidence(
      [
        {
          id: "11111111-1111-4111-8111-111111111111",
          workflow: "example.process",
          status: "Failed",
          outcome: null,
        },
      ],
      false,
    ),
  ).toEqual({
    kind: "verified",
    run: {
      id: "11111111-1111-4111-8111-111111111111",
      workflow: "example.process",
      status: "Failed",
      outcome: null,
    },
  })
})

it("surfaces unavailable reads without inventing evidence", () => {
  expect(verifyFirstRunEvidence(undefined, true)).toEqual({
    kind: "unavailable",
  })
})
