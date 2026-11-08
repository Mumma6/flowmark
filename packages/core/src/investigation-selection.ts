import { Result, Schema } from "effect"

const InternalId = Schema.String.check(
  Schema.isPattern(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  ),
)

/** Version 1 deliberately supports a run and one evidence page, not arbitrary cohorts. */
export const RunInvestigationSelectionSchema = Schema.Struct({
  version: Schema.Literal(1),
  kind: Schema.Literal("run"),
  projectId: InternalId,
  runId: InternalId,
  section: Schema.Literals(["events", "related", "expectations", "operations"]),
  cursor: Schema.optional(Schema.String.check(Schema.isMaxLength(2048))),
  limit: Schema.optional(
    Schema.Number.check(
      Schema.isInt(),
      Schema.isBetween({ minimum: 1, maximum: 100 }),
    ),
  ),
})
export type RunInvestigationSelection =
  typeof RunInvestigationSelectionSchema.Type

export const decodeRunInvestigationSelection = (value: unknown) =>
  Schema.decodeUnknownResult(RunInvestigationSelectionSchema)(value, {
    onExcessProperty: "error",
  })

/** No credential travels in a selection. The receiving tool authorizes independently. */
export const runSelectionToolInput = (value: unknown) =>
  decodeRunInvestigationSelection(value).pipe(
    Result.map(({ projectId, runId, section, cursor, limit }) => ({
      projectId,
      runId,
      section,
      cursor,
      limit,
    })),
  )
