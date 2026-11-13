import { expect, it } from "vitest"
import { Effect, Result, Schema } from "effect"
import {
  ShareInvestigationSchema,
  type BusinessMeaning,
} from "@flowmarkdev/core"
import { validateSharedSelection } from "../../src/features/shared-investigations/rules/selection.js"
const projectId = "11111111-1111-4111-8111-111111111111",
  runId = "22222222-2222-4222-8222-222222222222"
const meaning: BusinessMeaning = {
  results: [
    {
      workflow: "orders",
      revision: "v1",
      fields: [
        {
          path: ["count"],
          label: "Reported count",
          kind: "count",
          aggregate: true,
        },
        {
          path: ["private"],
          label: "Nonaggregate",
          kind: "count",
          aggregate: false,
        },
      ],
    },
  ],
  references: [{ workflow: "orders", keys: ["customer"] }],
}
const query = {
  workflow: "orders",
  revision: "v1",
  path: ["count"],
  currentStartedAfter: "2026-11-02T00:00:00.000Z",
  currentStartedBefore: "2026-11-03T00:00:00.000Z",
  previousStartedAfter: "2026-11-01T00:00:00.000Z",
  previousStartedBefore: "2026-11-02T00:00:00.000Z",
}
it("uses current publication and aggregation permissions before disclosing a saved business question", async () => {
  await expect(
    Effect.runPromise(
      validateSharedSelection(
        projectId,
        "business",
        { version: 1, depth: "business", query: { kind: "insights", query } },
        meaning,
      ),
    ),
  ).resolves.toBeUndefined()
  await expect(
    Effect.runPromise(
      validateSharedSelection(
        projectId,
        "owner",
        {
          version: 1,
          depth: "business",
          query: { kind: "insights", query: { ...query, path: ["private"] } },
        },
        meaning,
      ),
    ),
  ).rejects.toMatchObject({ _tag: "InvalidInput" })
  await expect(
    Effect.runPromise(
      validateSharedSelection(
        projectId,
        "owner",
        { version: 1, depth: "business", query: { kind: "insights", query } },
        { results: [], references: [] },
      ),
    ),
  ).rejects.toMatchObject({ _tag: "InvalidInput" })
})
it("does not widen or strip diagnostic scopes and continuation boundaries", async () => {
  const selection = {
    version: 1 as const,
    depth: "diagnostic" as const,
    query: {
      version: 1 as const,
      kind: "run" as const,
      projectId,
      runId,
      section: "events" as const,
    },
  }
  await expect(
    Effect.runPromise(
      validateSharedSelection(projectId, "viewer", selection, meaning),
    ),
  ).resolves.toBeUndefined()
  await expect(
    Effect.runPromise(
      validateSharedSelection(projectId, "business", selection, meaning),
    ),
  ).rejects.toMatchObject({ _tag: "InvalidInput" })
  await expect(
    Effect.runPromise(
      validateSharedSelection(runId, "owner", selection, meaning),
    ),
  ).rejects.toMatchObject({ _tag: "InvalidInput" })
  await expect(
    Effect.runPromise(
      validateSharedSelection(
        projectId,
        "owner",
        { ...selection, query: { ...selection.query, cursor: "next" } },
        meaning,
      ),
    ),
  ).rejects.toMatchObject({ _tag: "InvalidInput" })
})
it("rejects client payloads and credentials instead of persisting a richer shared object", () => {
  const decode = Schema.decodeUnknownResult(ShareInvestigationSchema, {
    onExcessProperty: "error",
  })
  const input = {
    title: "Question",
    selection: { version: 1, depth: "business", query: { kind: "run", runId } },
  }
  expect(Result.isSuccess(decode(input))).toBe(true)
  expect(
    Result.isFailure(decode({ ...input, result: { secret: "PRIVATE" } })),
  ).toBe(true)
  expect(
    Result.isFailure(
      decode({
        ...input,
        selection: {
          ...input.selection,
          query: { ...input.selection.query, authorization: "secret" },
        },
      }),
    ),
  ).toBe(true)
})
