import { Array, Schema } from "effect"
import { BusinessKeySchema, BusinessValueSchema } from "./search-fields.js"

const RunId = Schema.String.check(Schema.isGUID())
/** A lookup namespace is a workflow + declared key, never an unqualified value. */
export const ReferenceJourneyQuerySchema = Schema.Struct({
  workflow: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200)),
  key: BusinessKeySchema,
  value: BusinessValueSchema,
  namespaces: Schema.Array(
    Schema.Struct({
      workflow: Schema.String.check(
        Schema.isMinLength(1),
        Schema.isMaxLength(200),
      ),
      key: BusinessKeySchema,
    }),
  ).check(Schema.isMinLength(1), Schema.isMaxLength(8)),
  anchorRunId: Schema.optional(RunId),
  candidateCursor: Schema.optional(
    Schema.String.check(Schema.isMaxLength(4096)),
  ),
  cursor: Schema.optional(Schema.String.check(Schema.isMaxLength(4096))),
  limit: Schema.optional(
    Schema.Number.check(
      Schema.isInt(),
      Schema.isBetween({ minimum: 1, maximum: 50 }),
    ),
  ),
}).check(
  Schema.makeFilter(
    (query) =>
      Array.dedupe(
        Array.map(query.namespaces, (namespace) => namespace.workflow),
      ).length === query.namespaces.length &&
      Array.some(
        query.namespaces,
        (namespace) =>
          namespace.workflow === query.workflow && namespace.key === query.key,
      ),
  ),
)
export type ReferenceJourneyQuery = typeof ReferenceJourneyQuerySchema.Type

export interface JourneyRunReference {
  readonly id: string
  readonly externalId: string
  readonly workflow: string
  readonly startedAt: string
}
export interface JourneyNode extends JourneyRunReference {
  readonly depth: number
  readonly status: "Completed" | "Failed" | "Running"
  readonly outcome: string | null
  readonly parent: {
    readonly state: "absent" | "missing" | "ambiguous" | "resolved"
    readonly matches: readonly JourneyRunReference[]
  }
  readonly retry: {
    readonly state: "absent" | "missing" | "resolved"
    readonly matches: readonly JourneyRunReference[]
  }
}
export interface JourneyEdge {
  readonly fromRunId: string
  readonly toRunId: string
  readonly kind: "parent" | "retry"
  /** Context does not establish membership in the selected business reference. */
  readonly scope: "journey" | "context"
}
export interface ReferenceJourneyPage {
  readonly projectId: string
  readonly namespace: { readonly workflow: string; readonly key: string }
  readonly value: string
  readonly namespaces: ReferenceJourneyQuery["namespaces"]
  readonly state: "NotFound" | "Ambiguous" | "Selected"
  readonly anchorRunId: string | null
  readonly candidates: readonly JourneyRunReference[]
  readonly nextCandidateCursor: string | null
  readonly nodes: readonly JourneyNode[]
  readonly edges: readonly JourneyEdge[]
  readonly nextCursor: string | null
  readonly bounds: {
    readonly maxDepth: 4
    readonly maxNodes: 100
    readonly pageLimit: number
    readonly traversalTruncated: boolean
    readonly cycleDetected: boolean
  }
  readonly coverage: "Recorded linked evidence only; downstream sampling is not a complete funnel."
}
