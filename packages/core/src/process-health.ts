import { Schema } from "effect"
import { BusinessTimestampSchema } from "./business-insights.js"
import { ExpectationIdentifierSchema } from "./expectations.js"

export const PROCESS_HEALTH_METHOD = "observed-workflow-health-v1"
export const PROCESS_HEALTH_LIMITS = {
  windowDays: 31,
  runs: 2_000,
  expectationProjections: 10_000,
  fallbackEvents: 20_000,
  defaultPageSize: 25,
  pageSize: 100,
  statementTimeoutMs: 5_000,
  minimumMatureDeclarations: 5,
} as const

const Window = Schema.Struct({
  startedAfter: BusinessTimestampSchema,
  startedBefore: BusinessTimestampSchema,
}).check(
  Schema.makeFilter(({ startedAfter, startedBefore }) => {
    const duration = Date.parse(startedBefore) - Date.parse(startedAfter)
    return (
      duration > 0 && duration <= PROCESS_HEALTH_LIMITS.windowDays * 86_400_000
    )
  }),
)
const Token = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(512),
)
export const ProcessHealthQuerySchema = Schema.Struct({
  workflow: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200)),
  expectationName: ExpectationIdentifierSchema,
  window: Window,
  baseline: Schema.optional(Window),
  evidence: Schema.optional(Schema.Literals(["overdue", "mature"])),
  limit: Schema.optional(
    Schema.Number.check(
      Schema.isInt(),
      Schema.isBetween({ minimum: 1, maximum: PROCESS_HEALTH_LIMITS.pageSize }),
    ),
  ),
  cursor: Schema.optional(Token),
  previousObservation: Schema.optional(Token),
}).check(
  Schema.makeFilter(
    ({ window, baseline, cursor, previousObservation }) =>
      (!baseline ||
        Date.parse(baseline.startedBefore) <=
          Date.parse(window.startedAfter)) &&
      (cursor === undefined || previousObservation === undefined),
  ),
)

export type ProcessHealthQuery = typeof ProcessHealthQuerySchema.Type

export interface ProcessHealthWindow {
  readonly execution: {
    readonly completed: number
    readonly failed: number
    readonly withoutTerminal: number
  }
  readonly businessOutcomes: {
    readonly reported: readonly {
      readonly outcome: string
      readonly runs: number
    }[]
    readonly missing: number
  }
  readonly evidenceQuality: {
    readonly revisions: readonly (string | null)[]
    readonly runsWithoutDeclaration: number
    readonly unavailableProjections: number
    readonly settlementsWithoutDeclaration: number
    readonly otherExpectationDeclarations: number
    readonly intendedCoverage: "unknown"
  }
  readonly expectations: {
    readonly mature: number
    readonly overdue: number
    readonly metOnTime: number
    readonly metLate: number
    readonly immature: number
    readonly pending: number
    readonly cancelled: number
  }
}

export interface ProcessHealthRecord {
  readonly runId: string
  readonly expectationId: string
  readonly deadlineAt: string
  readonly state: "overdue" | "met-on-time" | "met-late"
}

export type ProcessHealthComparison =
  | {
      readonly status:
        | "no-baseline"
        | "incompatible-revisions"
        | "zero-denominator"
        | "thin-history"
    }
  | { readonly status: "comparable"; readonly overdueRateDelta: number }

export type ProcessHealth =
  | { readonly status: "unsupported-scope" }
  | {
      readonly status: "assessed"
      readonly selection: {
        readonly projectId: string
        readonly workflow: string
        readonly expectationName: string
        readonly window: ProcessHealthQuery["window"]
        readonly baseline?: ProcessHealthQuery["baseline"]
        readonly evidence: "overdue" | "mature"
      }
      readonly method: typeof PROCESS_HEALTH_METHOD
      readonly units: {
        readonly execution: "runs"
        readonly businessOutcomes: "runs"
        readonly expectations: "declarations"
      }
      readonly observedAt: string
      readonly observation: string
      readonly freshness: "new" | "unchanged" | "refreshed"
      readonly current: ProcessHealthWindow
      readonly baseline: ProcessHealthWindow | null
      readonly attention: "zero-denominator" | "quiet" | "overdue"
      readonly comparison: ProcessHealthComparison
      readonly evidence: {
        readonly total: number
        readonly records: readonly ProcessHealthRecord[]
        readonly nextCursor: string | null
      }
    }
