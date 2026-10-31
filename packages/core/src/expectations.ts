import { Schema } from "effect"
import { IngestionIdentifierSchema } from "./identifiers.js"
import { WorkflowOutcomeSchema } from "./results.js"
import { WorkflowResultSchema } from "./json.js"
import { WorkflowFailureSchema } from "./errors.js"

export const EXPECTATION_LIMIT = 100
export const MAX_EXPECTATION_DURATION_MS = 604_800_000
export const EXPECTATION_CAPABILITY = "expectations-v1"
export const ExpectationIdentifierSchema = Schema.String.check(
  Schema.isMaxLength(128),
  Schema.makeFilter(
    (value) =>
      value.trim().length > 0 &&
      !Array.from(value).some(
        (character) =>
          character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      ),
  ),
)
export const ExpectationDurationSchema = Schema.Number.check(
  Schema.makeFilter(
    (value) =>
      Number.isSafeInteger(value) &&
      value > 0 &&
      value <= MAX_EXPECTATION_DURATION_MS,
  ),
)
/** Pure bounded grammar; validation errors stay at the SDK/HTTP boundary. */
export function expectationDuration(within: string): number | undefined {
  if (typeof within !== "string" || within.length > 11) {
    return undefined
  }
  const match = /^([1-9][0-9]*)(ms|s|m|h|d)$/.exec(within)
  if (!match) {
    return undefined
  }
  const units: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000,
  }
  const milliseconds = Number(match[1]) * units[match[2]!]!
  return Schema.is(ExpectationDurationSchema)(milliseconds)
    ? milliseconds
    : undefined
}
export const ExpectationReferenceSchema = Schema.Struct({
  version: Schema.Literal(1),
  workflow: IngestionIdentifierSchema,
  runId: IngestionIdentifierSchema,
  expectationId: ExpectationIdentifierSchema,
})
export type ExpectationReference = typeof ExpectationReferenceSchema.Type
export interface ExpectationOptions {
  readonly id: string
  readonly within: string
}
export const ExpectationResolutionSchema = Schema.Struct({
  outcome: Schema.optional(WorkflowOutcomeSchema),
  result: Schema.optional(WorkflowResultSchema),
})
export type ExpectationResolution = typeof ExpectationResolutionSchema.Type
export const ExpectationCancellationSchema = Schema.Struct({
  code: WorkflowFailureSchema.fields.code,
  message: Schema.optional(Schema.String.check(Schema.isMaxLength(2048))),
})
export type ExpectationCancellation = typeof ExpectationCancellationSchema.Type
const identity = {
  workflow: IngestionIdentifierSchema,
  runId: IngestionIdentifierSchema,
  timestamp: Schema.String,
  expectationId: ExpectationIdentifierSchema,
}
export const ExpectationDeclaredSchema = Schema.Struct({
  ...identity,
  type: Schema.Literal("expectation_declared"),
  name: ExpectationIdentifierSchema,
  withinMs: ExpectationDurationSchema,
})
export const ExpectationResolvedSchema = Schema.Struct({
  ...identity,
  type: Schema.Literal("expectation_resolved"),
  ...ExpectationResolutionSchema.fields,
})
export const ExpectationCancelledSchema = Schema.Struct({
  ...identity,
  type: Schema.Literal("expectation_cancelled"),
  ...ExpectationCancellationSchema.fields,
})
export type ExpectationEvent =
  | typeof ExpectationDeclaredSchema.Type
  | typeof ExpectationResolvedSchema.Type
  | typeof ExpectationCancelledSchema.Type
export function isExpectationEvent(event: {
  readonly type: string
}): event is ExpectationEvent {
  return [
    "expectation_declared",
    "expectation_resolved",
    "expectation_cancelled",
  ].includes(event.type)
}
export const ExpectationStateSchema = Schema.Literals([
  "pending",
  "overdue",
  "met-on-time",
  "met-late",
  "cancelled",
])
export type ExpectationState = typeof ExpectationStateSchema.Type
export function expectationState(
  deadlineAt: string | null,
  settlementType: string | null,
  observedAt: string | null,
  asOf: string,
): ExpectationState | "unmatched" {
  if (deadlineAt === null) {
    return "unmatched"
  }
  if (settlementType === "expectation_cancelled") {
    return "cancelled"
  }
  if (settlementType === "expectation_resolved" && observedAt !== null) {
    return Date.parse(observedAt) <= Date.parse(deadlineAt)
      ? "met-on-time"
      : "met-late"
  }
  return Date.parse(asOf) > Date.parse(deadlineAt) ? "overdue" : "pending"
}
export interface ExpectationRecord {
  readonly reference: ExpectationReference
  readonly name: string | null
  readonly source: "server" | "browser"
  readonly state: ExpectationState | "unmatched"
  readonly declaredAt: string | null
  readonly deadlineAt: string | null
  readonly settledAt: string | null
  readonly declaration: {
    readonly eventId: string
    readonly event: ExpectationEvent
  } | null
  readonly settlement: {
    readonly eventId: string
    readonly event: ExpectationEvent
  } | null
  readonly outOfOrder: boolean
  readonly cancelledAfterDeadline: boolean
}
export interface RunExpectations {
  readonly asOf: string
  readonly expectations: readonly ExpectationRecord[]
  readonly unmatched: readonly ExpectationRecord[]
  readonly unavailableCount: number
}
export interface ExpectationAttention {
  readonly asOf: string
  readonly totalRuns: number
  readonly overdueRuns: number
  readonly overdueExpectations: number
}
