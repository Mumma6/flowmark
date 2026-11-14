import { Schema } from "effect"
import {
  ResultPathSchema,
  BusinessInsightsQuerySchema,
  type BusinessInsights,
} from "./business-insights.js"
import { BusinessKeySchema } from "./search-fields.js"
import { ReferenceJourneyQuerySchema } from "./reference-journey.js"
import { WorkflowOutcomeSchema } from "./results.js"
const Workflow = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(200),
)
export const BusinessPublicationSchema = Schema.Struct({
  results: Schema.Array(
    Schema.Struct({
      workflow: Workflow,
      revision: WorkflowOutcomeSchema,
      paths: Schema.Array(ResultPathSchema).check(Schema.isMaxLength(12)),
    }),
  ).check(Schema.isMaxLength(25)),
  references: Schema.Array(
    Schema.Struct({
      workflow: Workflow,
      keys: Schema.Array(BusinessKeySchema).check(Schema.isMaxLength(10)),
    }),
  ).check(Schema.isMaxLength(25)),
})
export type BusinessPublication = typeof BusinessPublicationSchema.Type
export const emptyBusinessPublication: BusinessPublication = {
  results: [],
  references: [],
}
const Limit = Schema.optional(
  Schema.Number.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: 50 }),
  ),
)
const Cursor = Schema.optional(Schema.String.check(Schema.isMaxLength(8192)))
const Timestamp = Schema.String.check(
  Schema.isMaxLength(40),
  Schema.makeFilter((value) => Number.isFinite(Date.parse(value))),
)
export const BusinessRunListSchema = Schema.Struct({
  workflow: Schema.optional(Workflow),
  status: Schema.optional(Schema.Literals(["Completed", "Failed", "Running"])),
  outcome: Schema.optional(WorkflowOutcomeSchema),
  startedAfter: Schema.optional(Timestamp),
  startedBefore: Schema.optional(Timestamp),
  businessKey: Schema.optional(BusinessKeySchema),
  businessValue: Schema.optional(
    Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(256)),
  ),
  cursor: Cursor,
  limit: Limit,
}).check(
  Schema.makeFilter(
    (q) =>
      (q.businessKey === undefined && q.businessValue === undefined) ||
      (q.businessKey !== undefined &&
        q.businessValue !== undefined &&
        q.workflow !== undefined),
  ),
)
export type BusinessRunList = typeof BusinessRunListSchema.Type
export const BusinessEvidenceQuerySchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("overview"),
    workflow: Schema.optional(Workflow),
    revision: Schema.optional(WorkflowOutcomeSchema),
  }),
  Schema.Struct({ kind: Schema.Literal("runs"), query: BusinessRunListSchema }),
  Schema.Struct({
    kind: Schema.Literal("run"),
    runId: Schema.String.check(Schema.isGUID()),
  }),
  Schema.Struct({
    kind: Schema.Literal("journey"),
    query: ReferenceJourneyQuerySchema,
  }),
  Schema.Struct({
    kind: Schema.Literal("insights"),
    query: BusinessInsightsQuerySchema.check(
      Schema.makeFilter(
        (query) =>
          query.businessValue === undefined ||
          (query.businessValue.length > 0 && query.businessValue.length <= 256),
      ),
    ),
  }),
  Schema.Struct({
    kind: Schema.Literal("compare"),
    runId: Schema.String.check(Schema.isGUID()),
    days: Schema.optional(
      Schema.Number.check(
        Schema.isInt(),
        Schema.isBetween({ minimum: 1, maximum: 90 }),
      ),
    ),
  }),
])
export type BusinessEvidenceQuery = typeof BusinessEvidenceQuerySchema.Type
export interface BusinessRunSummary {
  readonly id: string
  readonly workflow: string
  readonly status: "Completed" | "Failed" | "Running"
  readonly outcome: string | null
  readonly startedAt: string
  readonly durationMs: number | null
}
export interface PublishedResultField {
  readonly revision: string
  readonly path: readonly string[]
  readonly label: string
  readonly unit: string | null
  readonly kind: "count" | "category" | "reasons"
  readonly state: "available" | "missing" | "wrong-type" | "unknown-category"
  readonly value:
    | number
    | string
    | readonly { readonly value: string; readonly count: number }[]
    | null
}
export interface BusinessProjection {
  readonly version: 1
  readonly depth: "business"
  readonly projectId: string
  readonly publicationRevision: number
  readonly observedAt: string
  readonly withheld: readonly string[]
}
export interface BusinessMeaning {
  readonly results: readonly {
    readonly workflow: string
    readonly revision: string
    readonly fields: readonly {
      readonly path: readonly string[]
      readonly label: string
      readonly kind: "count" | "category" | "reasons"
      readonly aggregate: boolean
      readonly unit?: string
      readonly values?: readonly string[]
    }[]
  }[]
  readonly references: BusinessPublication["references"]
}
export type BusinessWorkflowSummary = {
  readonly name: string
  readonly runs: number
  readonly completedPercent: number | null
  readonly medianDurationMs: number | null
  readonly p95DurationMs: number | null
}
export type BusinessEvidenceData =
  | {
      readonly kind: "overview"
      readonly continued: boolean
      readonly workflows: readonly BusinessWorkflowSummary[]
      readonly meaning: BusinessMeaning
    }
  | {
      readonly kind: "runs"
      readonly runs: readonly BusinessRunSummary[]
      readonly total: number
      readonly limit: number
      readonly nextCursor: string | null
    }
  | {
      readonly kind: "run"
      readonly summary: BusinessRunSummary
      readonly fields: readonly PublishedResultField[]
      readonly references: readonly {
        readonly key: string
        readonly value: string
      }[]
    }
  | {
      readonly kind: "journey"
      readonly state: "NotFound" | "Ambiguous" | "Selected"
      readonly namespace: { readonly workflow: string; readonly key: string }
      readonly value: string
      readonly candidates: readonly Omit<
        BusinessRunSummary,
        "status" | "outcome" | "durationMs"
      >[]
      readonly nodes: readonly (Omit<BusinessRunSummary, "durationMs"> & {
        readonly depth: number
      })[]
      readonly edges: readonly {
        readonly fromRunId: string
        readonly toRunId: string
        readonly kind: "parent" | "retry"
        readonly scope: "journey" | "context"
      }[]
      readonly nextCursor: string | null
      readonly nextCandidateCursor: string | null
      readonly anchorRunId: string | null
      readonly bounds: {
        readonly maxDepth: 4
        readonly maxNodes: 100
        readonly pageLimit: number
        readonly traversalTruncated: boolean
        readonly cycleDetected: boolean
      }
      readonly coverage: string
    }
  | { readonly kind: "insights"; readonly report: BusinessInsights }
  | {
      readonly kind: "compare"
      readonly current: BusinessRunSummary | null
      readonly peers: readonly BusinessRunSummary[]
      readonly completedPercent: number | null
      readonly medianDurationMs: number | null
      readonly p95DurationMs: number | null
      readonly days: number
      readonly minimumSample: number
      readonly eligible: number
      readonly selected: number
    }
export interface BusinessEvidence {
  readonly projection: BusinessProjection
  readonly data: BusinessEvidenceData
}
