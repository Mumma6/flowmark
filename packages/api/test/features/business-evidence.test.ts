import { describe, expect, it } from "vitest"
import { Effect, Result, Schema } from "effect"
import { BusinessEvidenceQuerySchema } from "@flowmarkdev/core"
import {
  projectBusinessFields,
  projectBusinessReferences,
  projectBusinessSummary,
} from "../../src/features/business-evidence/rules/project-run.js"
import {
  validatePublication,
  publicationMeaning,
} from "../../src/features/business-evidence/rules/publication.js"
import {
  decodeBusinessCursor,
  encodeBusinessCursor,
} from "../../src/features/business-evidence/rules/cursor.js"
const choices = {
  declarations: [
    {
      workflow: "orders",
      declaration: {
        revision: "v1",
        fields: [
          { path: ["accepted"], label: "Accepted", kind: "count" as const },
          {
            path: ["category"],
            label: "Category",
            kind: "category" as const,
            values: ["yes", "no"],
          },
          {
            path: ["reasons"],
            label: "Reasons",
            kind: "reasons" as const,
            values: ["declined"],
          },
          { path: ["private"], label: "PRIVATE", kind: "category" as const },
        ],
      },
    },
  ],
  references: [
    {
      workflow: "orders",
      fields: [{ key: "customer", role: "lookup" as const }],
    },
  ],
}
const publication = {
  results: [
    {
      workflow: "orders",
      revision: "v1",
      paths: [["accepted"], ["category"], ["reasons"]],
    },
  ],
  references: [{ workflow: "orders", keys: ["customer"] }],
}
const meaning = publicationMeaning(publication, choices)
describe("business evidence allowlist", () => {
  it("constructs metadata and published primitives without copying arbitrary siblings", () => {
    const source = {
      id: "run",
      workflow: "orders",
      status: "Completed" as const,
      startedAt: "2026-11-13T10:00:00Z",
      durationMs: 12,
      outcome: "accepted",
      externalId: "PRIVATE_ID",
      result: {
        accepted: 3,
        category: "yes",
        reasons: { declined: 2 },
        private: "PRIVATE_RESULT",
      },
      definitionRevision: "v1",
    }
    expect(projectBusinessSummary(source)).not.toHaveProperty("externalId")
    const fields = projectBusinessFields(source, meaning)
    expect(fields.map((f) => f.value)).toEqual([
      3,
      "yes",
      [{ value: "declined", count: 2 }],
    ])
    expect(JSON.stringify(fields)).not.toContain("PRIVATE")
    expect(
      projectBusinessReferences(
        "orders",
        { customer: "customer-1", private: "PRIVATE_PROPERTY" },
        meaning,
      ),
    ).toEqual([{ key: "customer", value: "customer-1" }])
    expect(
      projectBusinessFields({ ...source, definitionRevision: "v2" }, meaning),
    ).toEqual([])
  })
  it("distinguishes missing, wrong type and unknown vocabulary without forwarding unknown values", () => {
    const fields = projectBusinessFields(
      {
        workflow: "orders",
        definitionRevision: "v1",
        result: {
          accepted: -1,
          category: "PRIVATE_CATEGORY",
          reasons: { PRIVATE_REASON: 1 },
        },
      },
      meaning,
    )
    expect(fields.map((f) => f.state)).toEqual([
      "wrong-type",
      "unknown-category",
      "unknown-category",
    ])
    expect(fields.every((f) => f.value === null)).toBe(true)
    expect(
      projectBusinessFields(
        { workflow: "orders", definitionRevision: "v1", result: null },
        meaning,
      ).every((f) => f.state === "missing"),
    ).toBe(true)
  })
  it("requires existing declarations and finite vocabularies; rejects duplicate entries", async () => {
    await expect(
      Effect.runPromise(validatePublication(publication, choices)),
    ).resolves.toBeUndefined()
    await expect(
      Effect.runPromise(
        validatePublication(
          {
            ...publication,
            results: [
              { workflow: "orders", revision: "v1", paths: [["private"]] },
            ],
          },
          choices,
        ),
      ),
    ).rejects.toMatchObject({ _tag: "InvalidInput" })
    await expect(
      Effect.runPromise(
        validatePublication(
          {
            ...publication,
            references: [{ workflow: "orders", keys: ["private"] }],
          },
          choices,
        ),
      ),
    ).rejects.toMatchObject({ _tag: "InvalidInput" })
    await expect(
      Effect.runPromise(
        validatePublication(
          {
            ...publication,
            results: [...publication.results, ...publication.results],
          },
          choices,
        ),
      ),
    ).rejects.toMatchObject({ _tag: "InvalidInput" })
  })
  it("binds continuation to the project, selected query and current publication", async () => {
    const cursor = encodeBusinessCursor("project", 3, "fingerprint", "next")!
    await expect(
      Effect.runPromise(
        decodeBusinessCursor(cursor, "project", 3, "fingerprint"),
      ),
    ).resolves.toBe("next")
    await expect(
      Effect.runPromise(
        decodeBusinessCursor(cursor, "foreign", 3, "fingerprint"),
      ),
    ).rejects.toMatchObject({ _tag: "InvalidInput" })
    await expect(
      Effect.runPromise(
        decodeBusinessCursor(cursor, "project", 4, "fingerprint"),
      ),
    ).rejects.toMatchObject({ _tag: "InvalidInput" })
    await expect(
      Effect.runPromise(decodeBusinessCursor(cursor, "project", 3, "changed")),
    ).rejects.toMatchObject({ _tag: "InvalidInput" })
  })
})

it("rejects oversized reference filters instead of probing unpublished values", () => {
  const query = {
    kind: "insights",
    query: {
      workflow: "orders",
      revision: "v1",
      path: ["accepted"],
      currentStartedAfter: "2026-11-01T00:00:00.000Z",
      currentStartedBefore: "2026-11-02T00:00:00.000Z",
      previousStartedAfter: "2026-10-31T00:00:00.000Z",
      previousStartedBefore: "2026-11-01T00:00:00.000Z",
      businessKey: "customer",
      businessValue: "x".repeat(257),
    },
  }
  const decode = Schema.decodeUnknownResult(BusinessEvidenceQuerySchema, {
    onExcessProperty: "error",
  })
  expect(Result.isFailure(decode(query))).toBe(true)
  expect(
    Result.isSuccess(
      decode({
        ...query,
        query: { ...query.query, businessValue: "x".repeat(256) },
      }),
    ),
  ).toBe(true)
})
