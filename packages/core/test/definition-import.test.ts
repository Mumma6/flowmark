import { Array, Option, Result, Schema } from "effect"
import { describe, expect, it } from "vitest"
import bookingDefinition from "../../../examples/booking-definition.json"
import {
  DefinitionImportSchema,
  previewDefinitionImport,
  type DefinitionImport,
  type ResultDeclaration,
  type SearchFields,
} from "../src/index.js"

const result: ResultDeclaration = {
  revision: "booking-v1",
  fields: [{ path: ["submitted"], label: "Submitted bookings", kind: "count" }],
}
const definition: DefinitionImport = {
  version: 1,
  source: "booking-app",
  workflow: "booking.create",
  result,
  searchFields: [{ key: "bookingRef", role: "lookup" }],
}
const empty = { result: Option.none<ResultDeclaration>(), searchFields: [] }
const decode = Schema.decodeUnknownResult(DefinitionImportSchema, {
  onExcessProperty: "error",
})

describe("explicit definition import preview", () => {
  it("shows the existing booking example's missing labels and searchable reference", () => {
    const sample = Schema.decodeUnknownSync(DefinitionImportSchema, {
      onExcessProperty: "error",
    })(bookingDefinition)
    expect(previewDefinitionImport(sample, empty)).toMatchObject({
      status: "Reviewable",
      result: { action: "Create", requested: sample.result },
      searchFields: {
        additions: definition.searchFields,
        conflicts: [],
        retained: [],
      },
    })
  })

  it("keeps historical revisions immutable and requires a new revision for changed meaning", () => {
    const current = { ...empty, result: Option.some(result) }
    const changed = { ...definition, result: { ...result, fields: [] } }
    expect(previewDefinitionImport(changed, current)).toMatchObject({
      status: "Conflict",
      result: { action: "Conflict" },
      searchFields: { proposed: null },
    })
    // The repository reads only the requested revision; a fresh revision is absent.
    expect(
      previewDefinitionImport(
        { ...changed, result: { ...changed.result, revision: "booking-v2" } },
        empty,
      ).result.action,
    ).toBe("Create")
    expect(result.fields[0]?.label).toBe("Submitted bookings")
  })

  it("does not adopt or overwrite identical Studio metadata", () => {
    const preview = previewDefinitionImport(
      {
        ...definition,
        result: {
          fields: [
            {
              kind: "count",
              aggregate: false,
              label: "Submitted bookings",
              path: ["submitted"],
            },
          ],
          revision: result.revision,
        },
      },
      { result: Option.some(result), searchFields: definition.searchFields! },
    )
    expect(preview.status).toBe("Unchanged")
    expect(preview.result.action).toBe("Unchanged")
    expect(preview.searchFields.additions).toEqual([])
  })

  it("preserves unmentioned keys, appends new keys and never interprets [] as deletion", () => {
    const fields: SearchFields = [
      { key: "region", role: "dimension", values: ["north"] },
    ]
    const current = { ...empty, searchFields: fields }
    expect(
      previewDefinitionImport(definition, current).searchFields.proposed,
    ).toEqual([...fields, ...definition.searchFields!])
    expect(
      previewDefinitionImport(
        { ...definition, result: undefined, searchFields: [] },
        current,
      ),
    ).toMatchObject({
      status: "Unchanged",
      result: { action: "NotRequested" },
      searchFields: { retained: fields, proposed: fields },
    })
  })

  it.each([
    [{ key: "bookingRef", role: "dimension", values: ["synthetic"] }],
    [{ key: "region", role: "dimension", values: ["south"] }],
  ] satisfies SearchFields[])(
    "rejects role/enum changes without replacing existing permissions: %j",
    (...fields) => {
      const current: SearchFields = [
        { key: "bookingRef", role: "lookup" },
        { key: "region", role: "dimension", values: ["north"] },
      ]
      const preview = previewDefinitionImport(
        { ...definition, searchFields: fields },
        { ...empty, searchFields: current },
      )
      expect(preview.status).toBe("Conflict")
      expect(preview.searchFields.conflicts).toEqual(fields)
      expect(preview.searchFields.retained).toEqual(current)
      expect(preview.searchFields.proposed).toBeNull()
    },
  )

  it("rejects a merged configuration above the existing eight-key limit", () => {
    const current: SearchFields = Array.makeBy(8, (index) => ({
      key: `field${index}`,
      role: "lookup" as const,
    }))
    expect(
      previewDefinitionImport(definition, { ...empty, searchFields: current }),
    ).toMatchObject({
      status: "Conflict",
      searchFields: { capacityExceeded: true, proposed: null },
    })
  })

  it.each([
    { ...definition, version: 2 },
    { ...definition, source: "" },
    { ...definition, workflow: " ".repeat(201) },
    { ...definition, result: undefined, searchFields: undefined },
    { ...definition, owner: "take-over" },
    { ...definition, result: { ...result, owner: "code" } },
    {
      ...definition,
      searchFields: [{ key: "bookingRef", role: "lookup", secret: true }],
    },
    {
      ...definition,
      searchFields: Array.makeBy(9, (index) => ({
        key: `key${index}`,
        role: "lookup",
      })),
    },
    {
      ...definition,
      searchFields: [
        { key: "bookingRef", role: "lookup" },
        { key: "bookingRef", role: "lookup" },
      ],
    },
  ])("rejects unsupported, unbounded or implicit metadata: %j", (input) => {
    expect(Result.isFailure(decode(input))).toBe(true)
  })
})
