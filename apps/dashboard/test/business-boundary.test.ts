import { createElement } from "react"
import { beforeEach, expect, it, vi } from "vitest"
const state = vi.hoisted(() => ({
  project: {
    current: null as null | { id: string; role: string },
    pending: false,
    error: null as null | { message: string },
    retry: vi.fn(),
  },
}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/runs",
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("../features/projects/project-context", () => ({
  useProject: () => state.project,
}))
vi.mock("../features/business-evidence/business-workspace", () => ({
  BusinessWorkspace: () => createElement("p", null, "Projected workspace"),
}))
import { BusinessBoundary } from "../features/business-evidence/business-boundary"
import { BusinessWorkspace } from "../features/business-evidence/business-workspace"
beforeEach(() => {
  state.project.current = null
  state.project.pending = false
  state.project.error = null
})
// Inspect the boundary decision before React can mount any read-owning child.
// The mocked project/navigation hooks contain no React state.
const diagnosticReader = createElement("section", {
  "aria-label": "Diagnostic reader",
})
const decide = () => BusinessBoundary({ children: diagnosticReader })
it.each(["unselected", "pending", "failed"])(
  "withholds diagnostic children while project authority is %s",
  (condition) => {
    state.project.pending = condition === "pending"
    state.project.error =
      condition === "failed" ? { message: "Unavailable" } : null
    expect(decide()).not.toBe(diagnosticReader)
  },
)
it("selects projected children for business access and preserves diagnostic access", () => {
  state.project.current = { id: "project", role: "business" }
  expect(decide()).toMatchObject({
    type: BusinessWorkspace,
    props: { projectId: "project" },
  })
  state.project.current = { id: "project", role: "viewer" }
  expect(decide()).toBe(diagnosticReader)
})
