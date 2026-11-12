import { Schema } from "effect"
import { BusinessTimestampSchema } from "./business-insights.js"
import { RunInvestigationSelectionSchema } from "./investigation-selection.js"

export const PUBLIC_READ_BOUNDS = {
  requestBytes: 8 * 1024,
  responseBytes: 64 * 1024,
  timeoutMs: 15_000,
  statementTimeoutMs: 5_000,
} as const

export const RunReadInputSchema = Schema.Struct({
  ...RunInvestigationSelectionSchema.fields,
  section: Schema.Literal("events"),
  cursor: Schema.optional(
    Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(2048)),
  ),
})
export type RunReadInput = typeof RunReadInputSchema.Type

const Count = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
)
const Duration = Schema.NullOr(Schema.Number.check(Schema.isFinite()))
const Limit = Schema.Number.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 1, maximum: 100 }),
)
export const RunReadResponseSchema = Schema.Struct({
  version: Schema.Literal(1),
  selection: Schema.Struct({ ...RunReadInputSchema.fields, limit: Limit }),
  observedAt: BusinessTimestampSchema,
  summary: Schema.Struct({
    id: RunReadInputSchema.fields.runId,
    workflow: Schema.String,
    status: Schema.Literals(["Running", "Completed", "Failed"]),
    startedAt: BusinessTimestampSchema,
    durationMs: Duration,
    eventCount: Count,
  }),
  page: Schema.Struct({
    events: Schema.Array(
      Schema.Struct({
        id: RunReadInputSchema.fields.runId,
        type: Schema.String,
        timestamp: BusinessTimestampSchema,
        durationMs: Duration,
      }),
    ).check(Schema.isMaxLength(100)),
    limit: Limit,
    totalEvents: Count,
    nextCursor: Schema.NullOr(
      Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(2048)),
    ),
  }),
  evidence: Schema.Struct({ runPath: Schema.String }),
  omissions: Schema.Array(Schema.String),
})
export type RunReadResponse = typeof RunReadResponseSchema.Type

export const RunReadErrorSchema = Schema.Struct({
  version: Schema.Literal(1),
  error: Schema.Struct({
    code: Schema.NonEmptyString,
    message: Schema.String,
    retryAfterSeconds: Schema.NullOr(
      Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
    ),
  }),
})
export type RunReadError = typeof RunReadErrorSchema.Type

/** Data-only Studio link: recipients still independently authorize the selection. */
export const runReadEvidencePath = (selection: RunReadInput) =>
  `/runs/${encodeURIComponent(selection.runId)}?${new URLSearchParams({
    selection: JSON.stringify({
      version: selection.version,
      kind: selection.kind,
      projectId: selection.projectId,
      runId: selection.runId,
      section: selection.section,
      ...(selection.cursor === undefined ? {} : { cursor: selection.cursor }),
      ...(selection.limit === undefined ? {} : { limit: selection.limit }),
    }),
  })}`
