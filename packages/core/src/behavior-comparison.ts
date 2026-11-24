import { Schema } from "effect"
import type { ReceiptCohort } from "./receipt-cohort.js"
import { RuntimeProbeReferenceSchema } from "./runtime-observation.js"

const bounded = (max: number) =>
  Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(max))

const Cohort = Schema.Struct({
  deploymentId: RuntimeProbeReferenceSchema.fields.deploymentId,
  startedAfter: bounded(40),
  startedBefore: bounded(40),
  samplingPolicy: Schema.optional(bounded(80)),
})

const metrics = [
  "handledError",
  "fallback",
  "partialOutcome",
  "normalPath",
] as const

export const BehaviorComparisonSchema = Schema.Struct({
  bindingId: RuntimeProbeReferenceSchema.fields.bindingId,
  behaviorId: RuntimeProbeReferenceSchema.fields.probeId,
  workflow: bounded(200),
  before: Cohort,
  after: Cohort,
  fallbackStep: bounded(200),
  normalStep: bounded(200),
  partialOutcome: bounded(64),
  drilldown: Schema.optional(
    Schema.Struct({
      cohort: Schema.Literals(["before", "after"]),
      metric: Schema.Literals(metrics),
      afterRunId: Schema.optional(Schema.String.check(Schema.isUUID())),
    }),
  ),
})

export const behaviorComparisonMetrics = metrics
export type BehaviorComparisonQuery = typeof BehaviorComparisonSchema.Type
export type BehaviorComparisonMetric = (typeof metrics)[number]

export type BehaviorComparisonExample = {
  readonly runId: string
  readonly observationEventId: string
  readonly signalEventId: string
}

export type BehaviorComparisonCohort = {
  readonly artifactDigest: string
  readonly revision: string
  readonly eligibleRuns: number
  readonly unattributedRuns: number
  readonly otherDeploymentRuns: number
  readonly ambiguousRuns: number
  readonly reportedLoss: number
  readonly counts: Readonly<
    Record<
      BehaviorComparisonMetric,
      {
        readonly total: number
        readonly examples: readonly BehaviorComparisonExample[]
      }
    >
  >
  readonly receiptCohort: ReceiptCohort
  readonly rate: null | Readonly<Record<BehaviorComparisonMetric, number>>
  readonly examplesByArtifact: readonly {
    readonly artifactDigest: string
    readonly deploymentId: string
    readonly examples: readonly BehaviorComparisonExample[]
  }[]
}

export type BehaviorComparison =
  | {
      readonly status: "unsupported"
      readonly reason:
        | "deployment-not-found"
        | "incompatible-behavior-revisions"
        | "read-budget"
    }
  | {
      readonly status: "comparable-recorded-cohorts" | "limited"
      readonly environment: string
      readonly service: string
      readonly repository: string
      readonly behaviorRevision: string
      readonly limitations: readonly string[]
      readonly before: BehaviorComparisonCohort
      readonly after: BehaviorComparisonCohort
      readonly drilldown?: {
        readonly total: number
        readonly examples: readonly BehaviorComparisonExample[]
        readonly nextAfterRunId: string | null
      }
    }
