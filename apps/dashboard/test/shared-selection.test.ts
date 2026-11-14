import { expect, it } from "vitest"
import { Array, Result } from "effect"
import {
  businessSelectionFromSaved,
  sharedQuestionHref,
  sharedSelectionHref,
} from "../features/shared-investigations/shared-selection"
const projectId = "11111111-1111-4111-8111-111111111111",
  runId = "22222222-2222-4222-8222-222222222222"
const saved = {
  version: 1 as const,
  kind: "run" as const,
  projectId,
  runId,
  section: "events" as const,
}
it("cannot turn copied identifiers into another project, credential parameter or external destination", () => {
  const supplied = "../?project=foreign&authorization=secret#fragment"
  const url = new URL(
    sharedQuestionHref(projectId, supplied),
    "http://127.0.0.1:3001",
  )
  expect(url.origin).toBe("http://127.0.0.1:3001")
  expect(url.pathname).toBe("/investigations")
  expect(Array.fromIterable(url.searchParams.keys())).toEqual([
    "project",
    "shared",
  ])
  expect(url.searchParams.get("project")).toBe(projectId)
  expect(url.searchParams.get("shared")).toBe(supplied)
  expect(url.hash).toBe("")
})

it("keeps diagnostic selections scoped and converts only supported first-page business questions", () => {
  expect(businessSelectionFromSaved(saved)).toEqual({
    version: 1,
    depth: "business",
    query: { kind: "run", runId },
  })
  expect(businessSelectionFromSaved({ ...saved, cursor: "next" })).toBeNull()
  expect(
    businessSelectionFromSaved({ ...saved, section: "operations" }),
  ).toBeNull()
  expect(
    Result.isFailure(
      sharedSelectionHref(runId, {
        version: 1,
        depth: "diagnostic",
        query: saved,
      }),
    ),
  ).toBe(true)
  const href = sharedSelectionHref(projectId, {
    version: 1,
    depth: "business",
    query: { kind: "run", runId },
  })
  expect(Result.getOrNull(href)).toContain("businessSelection=")
})
