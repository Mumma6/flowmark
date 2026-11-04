import { Array, Data, Effect, Result, pipe } from "effect"
import { and, eq, inArray, or, sql } from "drizzle-orm"
import type { WorkflowEvent } from "@flowmarkdev/core"
import type { FlowmarkDatabase } from "../client.js"
import { workflowEvents, workflowRuns, workflows } from "../schema/index.js"
import { Database, DatabaseError } from "../persistence/database.js"
import { DatabaseOperation } from "../persistence/database-operation.js"
import { runQuery } from "../persistence/run-query.js"
import {
  eventError,
  eventFailure,
  eventProperties,
  eventResult,
} from "../persistence/workflows/writes/event-fields.js"

export { findFixtureAccount, findFixtureProjects } from "./account.js"
export { FixtureEventTransaction } from "../persistence/event-transaction.js"

export class DatasetConflict extends Data.TaggedError("DatasetConflict")<{
  readonly reason: string
}> {}
export interface DatasetManifest {
  readonly identity: string
  readonly configHash: string
  readonly runs: readonly {
    readonly workflow: string
    readonly runId: string
    readonly events: readonly {
      readonly eventId: string
      readonly event: WorkflowEvent
    }[]
  }[]
}

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${Array.map(value, canonical).join(",")}]`
  }
  if (value !== null && typeof value === "object") {
    return `{${pipe(
      Array.fromIterable(Object.entries(value)),
      Array.filter(([, item]) => item !== undefined),
      Array.sort((left: [string, unknown], right: [string, unknown]) =>
        left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0,
      ),
      Array.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`),
    ).join(",")}}`
  }
  return JSON.stringify(value) ?? "undefined"
}

/** Exactly the persisted contract, excluding genuine storage receipt time/row identity. */
const persisted = (event: WorkflowEvent) => ({
  type: event.type,
  occurredAt: new Date(event.timestamp).toISOString(),
  step: event.type === "step" ? event.step : null,
  operationId: "operationId" in event ? event.operationId : null,
  operationName: "operationName" in event ? event.operationName : null,
  attempt: "attempt" in event ? (event.attempt ?? null) : null,
  durationMs: "durationMs" in event ? event.durationMs : null,
  progressCompleted: event.type === "progress" ? event.completed : null,
  progressTotal: event.type === "progress" ? (event.total ?? null) : null,
  progressUnit: event.type === "progress" ? (event.unit ?? null) : null,
  reason: event.type === "failed" ? (event.reason ?? null) : null,
  properties: eventProperties(event) ?? null,
  error: eventError(event, eventFailure(event)),
  result: eventResult(event) ?? null,
  outcome:
    "outcome" in event && !event.type.startsWith("expectation_")
      ? (event.outcome ?? null)
      : null,
  expectation: event.type.startsWith("expectation_") ? event : null,
})

/** Run-row locks and the surrounding transaction cover verification AND deletion. */
export const inspectDataset = Effect.fn("inspectDataset")(function* (
  projectId: string,
  manifest: DatasetManifest,
) {
  const db = yield* Database
  if (
    manifest.identity !== "meridian-health-v1" ||
    !manifest.runs.length ||
    !/^[a-f0-9]{64}$/.test(manifest.configHash)
  ) {
    return yield* new DatasetConflict({
      reason: "Invalid Meridian fixture manifest.",
    })
  }
  const expected = new Map(
    Array.map(
      manifest.runs,
      (run) => [`${run.workflow}/${run.runId}`, run] as const,
    ),
  )
  if (
    expected.size !== manifest.runs.length ||
    manifest.runs.some((run) => !run.runId.startsWith(`${manifest.identity}:`))
  ) {
    return yield* new DatasetConflict({
      reason: "Duplicate or unscoped fixture identities.",
    })
  }
  const rows = yield* runQuery(DatabaseOperation.InspectDataset, () =>
    db
      .select({
        id: workflowRuns.id,
        externalId: workflowRuns.externalId,
        name: workflows.name,
        properties: workflowRuns.properties,
        startedAt: workflowRuns.startedAt,
        correlationId: workflowRuns.correlationId,
        parentRunId: workflowRuns.parentRunId,
        retryOf: workflowRuns.retryOf,
      })
      .from(workflowRuns)
      .innerJoin(workflows, eq(workflowRuns.workflowId, workflows.id))
      .where(
        and(
          eq(workflows.projectId, projectId),
          or(
            sql`${workflowRuns.properties}->>'demoDataset' = ${manifest.identity}`,
            sql`left(${workflowRuns.externalId}, ${manifest.identity.length + 1}) = ${`${manifest.identity}:`}`,
          ),
        ),
      )
      .for("update", { of: workflowRuns }),
  )
  const eventRows = rows.length
    ? yield* runQuery(DatabaseOperation.InspectDataset, () =>
        db
          .select()
          .from(workflowEvents)
          .where(
            inArray(
              workflowEvents.runId,
              Array.map(rows, (row) => row.id),
            ),
          ),
      )
    : []
  const eventsByRun = Array.groupBy(eventRows, (event) => event.runId)
  const verified = yield* Effect.forEach(rows, (row) =>
    Effect.gen(function* () {
      const planned = expected.get(`${row.name}/${row.externalId}`)
      const start = planned?.events[0]?.event
      if (
        !planned ||
        start?.type !== "started" ||
        row.properties?.demoDataset !== manifest.identity ||
        row.properties?.demoConfig !== manifest.configHash ||
        canonical(row.properties) !== canonical(start.properties) ||
        row.startedAt.toISOString() !== start.timestamp ||
        row.correlationId !== (start.correlationId ?? null) ||
        row.parentRunId !== (start.parentRunId ?? null) ||
        canonical(row.retryOf) !== canonical(start.retryOf ?? null)
      ) {
        return yield* new DatasetConflict({
          reason:
            "Run ownership or configuration differs. Retain the original reference/seed; inspect before changing or deleting data.",
        })
      }
      const events = eventsByRun[row.id] ?? []
      const envelopes = new Map(
        Array.map(
          planned.events,
          (item) => [item.eventId, item.event] as const,
        ),
      )
      yield* Effect.forEach(events, (stored) =>
        Effect.gen(function* () {
          const intended = envelopes.get(stored.eventId)
          const actual = {
            type: stored.type,
            occurredAt: stored.occurredAt.toISOString(),
            step: stored.step,
            operationId: stored.operationId,
            operationName: stored.operationName,
            attempt: stored.attempt,
            durationMs: stored.durationMs,
            progressCompleted: stored.progressCompleted,
            progressTotal: stored.progressTotal,
            progressUnit: stored.progressUnit,
            reason: stored.reason,
            properties: stored.properties,
            error: stored.error,
            result: stored.result,
            outcome: stored.outcome,
            expectation: stored.expectation,
          }
          if (
            !intended ||
            canonical(actual) !== canonical(persisted(intended))
          ) {
            return yield* new DatasetConflict({
              reason:
                "Unowned or changed event found in a demo run. No telemetry was deleted.",
            })
          }
        }),
      )
      return {
        id: row.id,
        events: events.length,
        expectedEvents: planned.events.length,
      }
    }),
  )
  return {
    rows: verified,
    runs: verified.length,
    events: Array.reduce(verified, 0, (sum, row) => sum + row.events),
    complete:
      verified.length === manifest.runs.length &&
      verified.every((row) => row.events === row.expectedEvents),
  }
})

/** Only these verified raw run identities are removed. Config, workflows, users and keys are retained. */
export const resetDataset = Effect.fn("resetDataset")(function* (
  projectId: string,
  manifest: DatasetManifest,
) {
  const db = yield* Database
  const status = yield* inspectDataset(projectId, manifest)
  const ids = Array.map(status.rows, (row) => row.id)
  if (ids.length) {
    yield* runQuery(DatabaseOperation.ResetDataset, () =>
      db.delete(workflowEvents).where(inArray(workflowEvents.runId, ids)),
    )
    yield* runQuery(DatabaseOperation.ResetDataset, () =>
      db.delete(workflowRuns).where(inArray(workflowRuns.id, ids)),
    )
  }
  return { runs: status.runs, events: status.events }
})

/** Shared by seed/reset/reseed. Appenders use the same run locks; unknown evidence aborts the transaction. */
export const withDatasetTransaction = <A, E>(
  db: FlowmarkDatabase,
  projectId: string,
  use: (transaction: FlowmarkDatabase) => Effect.Effect<A, E>,
) =>
  Effect.tryPromise({
    // Drizzle owns the Promise callback. A rejection here rolls back the entire fixture transaction.
    try: (signal) =>
      db.transaction(async (tx) =>
        Result.match(
          await Effect.runPromise(
            Effect.result(
              runQuery(DatabaseOperation.DatasetTransaction, () =>
                tx.execute(
                  sql`select pg_advisory_xact_lock(hashtextextended(${`meridian-health-v1:${projectId}`}, 0))`,
                ),
              ).pipe(
                Effect.flatMap(() => use(tx as unknown as FlowmarkDatabase)),
              ),
            ),
            { signal },
          ),
          {
            onSuccess: (value) => value,
            onFailure: (failure) => {
              throw new DatasetRollback({ failure })
            },
          },
        ),
      ),
    catch: (cause) =>
      cause instanceof DatasetRollback
        ? (cause.failure as E | DatabaseError)
        : new DatabaseError({
            operation: DatabaseOperation.DatasetTransaction,
            cause,
          }),
  })

class DatasetRollback extends Data.TaggedError("DatasetRollback")<{
  readonly failure: unknown
}> {}
