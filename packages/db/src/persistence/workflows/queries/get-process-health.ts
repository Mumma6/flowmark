import { createHash } from "node:crypto"
import { sql } from "drizzle-orm"
import { Array, Data, Effect, Option, Schema } from "effect"
import {
  PROCESS_HEALTH_LIMITS as bounds,
  PROCESS_HEALTH_METHOD,
  type ProcessHealth,
  type ProcessHealthQuery,
} from "@flowmarkdev/core"
import { Database, InvalidResultQuery } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { ExpectationObservationClock } from "../observation-clock.js"
import { processHealthSql } from "../sql/process-health.js"

export class ProcessHealthBudgetExceeded extends Data.TaggedError(
  "ProcessHealthBudgetExceeded",
)<{
  readonly budget: "runs" | "fallback-events" | "expectation-projections"
}> {}

type Assessment = Extract<ProcessHealth, { status: "assessed" }>
export type ProcessHealthEvidence =
  | Extract<ProcessHealth, { status: "unsupported-scope" }>
  | Omit<Assessment, "attention" | "comparison">

const Digest = Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/))
const Observation = Schema.Struct({
  selection: Digest,
  fingerprint: Digest,
  offset: Schema.Number.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 0, maximum: bounds.expectationProjections }),
  ),
})
const decodeObservation = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Observation),
  { onExcessProperty: "error" },
)

export const getProcessHealth = Effect.fn("getProcessHealth")(function* (
  projectId: string,
  query: ProcessHealthQuery,
) {
  const selection = {
    projectId,
    workflow: query.workflow,
    expectationName: query.expectationName,
    window: query.window,
    baseline: query.baseline,
    evidence: query.evidence ?? "overdue",
  } satisfies Assessment["selection"]
  const selectionDigest = createHash("sha256")
    .update(
      JSON.stringify([
        PROCESS_HEALTH_METHOD,
        projectId,
        selection.workflow,
        selection.expectationName,
        selection.window.startedAfter,
        selection.window.startedBefore,
        selection.baseline?.startedAfter,
        selection.baseline?.startedBefore,
        selection.evidence,
      ]),
    )
    .digest("hex")
  const token = query.cursor ?? query.previousObservation
  const invalidContinuation = () =>
    new InvalidResultQuery({
      message: "Invalid process health continuation or selection.",
    })
  const prior =
    token === undefined
      ? undefined
      : yield* decodeObservation(token).pipe(
          Effect.mapError(invalidContinuation),
        )
  if (
    prior &&
    (prior.selection !== selectionDigest ||
      (query.cursor ? prior.offset === 0 : prior.offset !== 0))
  ) {
    return yield* invalidContinuation()
  }

  const db = yield* Database
  yield* runQuery(DatabaseOperation.ReadProcessHealth, () =>
    db.execute(
      // The population is capped. JIT startup can dominate a read if statistics overestimate it.
      sql`SELECT set_config('statement_timeout', ${String(bounds.statementTimeoutMs)}, true),
                 set_config('jit', 'off', true)`,
    ),
  )
  const clock = yield* ExpectationObservationClock
  const observedAt = (yield* clock.now(db)).toISOString()
  const limit = query.limit ?? bounds.defaultPageSize
  const rows = yield* runQuery(DatabaseOperation.ReadProcessHealth, () =>
    db.execute<{
      supported: boolean
      exceeded: ProcessHealthBudgetExceeded["budget"] | null
      fingerprint: string
      current: Assessment["current"]
      baseline: Assessment["baseline"]
      records: Assessment["evidence"]["records"]
    }>(
      processHealthSql(
        projectId,
        query,
        observedAt,
        prior?.offset ?? 0,
        limit,
        prior?.fingerprint,
      ),
    ),
  )
  const row = Option.getOrThrow(Array.head(rows))
  if (row.exceeded) {
    return yield* new ProcessHealthBudgetExceeded({ budget: row.exceeded })
  }
  if (!row.supported) {
    return { status: "unsupported-scope" } as const
  }

  const freshness =
    prior === undefined
      ? "new"
      : prior.fingerprint === row.fingerprint
        ? "unchanged"
        : "refreshed"
  const offset = freshness === "unchanged" ? (prior?.offset ?? 0) : 0
  const total = row.current.expectations[selection.evidence]
  if (offset > 0 && offset >= total) {
    return yield* invalidContinuation()
  }
  const nextOffset = offset + row.records.length
  const encode = (offset: number) =>
    JSON.stringify({
      selection: selectionDigest,
      fingerprint: row.fingerprint,
      offset,
    } satisfies typeof Observation.Type)
  return {
    status: "assessed",
    selection,
    method: PROCESS_HEALTH_METHOD,
    units: {
      execution: "runs",
      businessOutcomes: "runs",
      expectations: "declarations",
    },
    observedAt,
    observation: encode(0),
    freshness,
    current: row.current,
    baseline: row.baseline,
    evidence: {
      total,
      records: row.records,
      nextCursor: nextOffset < total ? encode(nextOffset) : null,
    },
  } satisfies ProcessHealthEvidence
})
