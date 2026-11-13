import { expect, it } from "vitest"
import { readBusinessLocation } from "../features/business-evidence/business-location"
const projectId = "11111111-1111-4111-8111-111111111111",
  runId = "22222222-2222-4222-8222-222222222222"
it("reopens an exact business selection and compatible saved run without raw selectors", () => {
  const selection = { kind: "run", runId }
  expect(
    readBusinessLocation(
      projectId,
      "/",
      new URLSearchParams({ businessSelection: JSON.stringify(selection) }),
    ),
  ).toEqual(selection)
  expect(
    readBusinessLocation(
      projectId,
      `/runs/${runId}`,
      new URLSearchParams({
        selection: JSON.stringify({
          version: 1,
          kind: "run",
          projectId,
          runId,
          section: "events",
        }),
      }),
    ),
  ).toEqual(selection)
})
it.each(["operations", "expectations", "related"])(
  "rejects a diagnostic %s selection instead of widening to another query",
  (section) => {
    expect(
      readBusinessLocation(
        projectId,
        `/runs/${runId}`,
        new URLSearchParams({
          selection: JSON.stringify({
            version: 1,
            kind: "run",
            projectId,
            runId,
            section,
          }),
        }),
      ),
    ).toBeNull()
  },
)
it("rejects malformed, foreign and hidden selections", () => {
  expect(
    readBusinessLocation(
      projectId,
      "/",
      new URLSearchParams({ businessSelection: "bad-json" }),
    ),
  ).toBeNull()
  expect(
    readBusinessLocation(
      projectId,
      `/runs/${runId}`,
      new URLSearchParams({
        selection: JSON.stringify({
          version: 1,
          kind: "run",
          projectId: runId,
          runId,
          section: "events",
        }),
      }),
    ),
  ).toBeNull()
  expect(
    readBusinessLocation(
      projectId,
      "/",
      new URLSearchParams({
        businessSelection: JSON.stringify({
          kind: "runs",
          query: { environment: "secret" },
        }),
      }),
    ),
  ).toBeNull()
})

it.each(["environment", "release", "inspector", "reference"])(
  "rejects a legacy %s parameter even alongside a valid selection",
  (key) => {
    expect(
      readBusinessLocation(
        projectId,
        "/",
        new URLSearchParams({
          businessSelection: JSON.stringify({ kind: "overview" }),
          [key]: "hidden",
        }),
      ),
    ).toBeNull()
  },
)
