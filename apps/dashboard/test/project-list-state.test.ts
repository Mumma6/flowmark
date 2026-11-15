import { expect, it } from "vitest"
import { projectListState } from "../features/projects/project-list-state"

it("keeps a failed project list distinct from an account with no projects", () => {
  expect(projectListState({ pending: false, failed: true, count: 0 })).toBe(
    "unavailable",
  )
  expect(projectListState({ pending: false, failed: false, count: 0 })).toBe(
    "empty",
  )
  expect(projectListState({ pending: true, failed: false, count: 0 })).toBe(
    "pending",
  )
  expect(projectListState({ pending: false, failed: true, count: 2 })).toBe(
    "ready",
  )
})
