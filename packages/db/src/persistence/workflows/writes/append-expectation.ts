import { ExpectationObservationClock } from "../observation-clock.js"
import { and, eq } from "drizzle-orm"
import { Effect, Match } from "effect"
import { EXPECTATION_LIMIT, type ExpectationEvent } from "@flowmarkdev/core"
import { workflowEvents, workflowExpectations } from "../../../schema/index.js"
import type { FlowmarkDatabase } from "../../../client.js"
import { runQuery } from "../../run-query.js"
import { DatabaseOperation } from "../../database-operation.js"

type Transaction = Parameters<Parameters<FlowmarkDatabase["transaction"]>[0]>[0]
/** Canonical structural equality: object order is not business meaning. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(",")}]`
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`
  }
  return JSON.stringify(value) ?? "undefined"
}
function payload(event: ExpectationEvent) {
  return Match.value(event).pipe(
    Match.when(
      { type: "expectation_declared" },
      ({ type, expectationId, name, withinMs }) => ({
        type,
        expectationId,
        name,
        withinMs,
      }),
    ),
    Match.when(
      { type: "expectation_resolved" },
      ({ type, expectationId, outcome, result }) => ({
        type,
        expectationId,
        outcome,
        result,
      }),
    ),
    Match.when(
      { type: "expectation_cancelled" },
      ({ type, expectationId, code, message }) => ({
        type,
        expectationId,
        code,
        message,
      }),
    ),
    Match.exhaustive,
  )
}

/** Called only while appendEvent owns the authorized run-row lock and envelope lock. */
export const appendExpectation = Effect.fn("appendExpectation")(function* (
  tx: Transaction,
  runId: string,
  eventId: string,
  event: ExpectationEvent,
  closed: boolean,
) {
  const query = <A>(f: () => Promise<A>) =>
    runQuery(DatabaseOperation.AppendExpectation, f)
  const [projection] = yield* query(() =>
    tx
      .select()
      .from(workflowExpectations)
      .where(
        and(
          eq(workflowExpectations.runId, runId),
          eq(workflowExpectations.expectationId, event.expectationId),
        ),
      ),
  )
  const facts = yield* query(() =>
    tx
      .select({ id: workflowEvents.id, event: workflowEvents.expectation })
      .from(workflowEvents)
      .where(eq(workflowEvents.runId, runId)),
  )
  // Lost canonical evidence cannot silently reset a deadline or settle an invented declaration.
  if (
    !projection &&
    facts.some((row) => row.event?.expectationId === event.expectationId)
  ) {
    return "expectation_conflict"
  }
  const canonicalId =
    event.type === "expectation_declared"
      ? projection?.declarationEventId
      : projection?.settlementEventId
  const previous = canonicalId
    ? facts.find((row) => row.id === canonicalId)?.event
    : undefined
  if (canonicalId && !previous) {
    return "expectation_conflict"
  }
  const duplicate = previous !== undefined
  if (previous && canonical(payload(previous)) !== canonical(payload(event))) {
    return "expectation_conflict"
  }
  if (!duplicate && event.type === "expectation_declared" && closed) {
    return "expectation_closed"
  }
  if (!projection) {
    const ids = new Set(
      facts.flatMap((row) => (row.event ? [row.event.expectationId] : [])),
    )
    if (ids.size >= EXPECTATION_LIMIT) {
      return "expectation_limit"
    }
  }
  const ownerId =
    projection?.id ?? (yield* Effect.sync(() => globalThis.crypto.randomUUID()))
  if (!projection) {
    yield* query(() =>
      tx
        .insert(workflowExpectations)
        .values({ id: ownerId, runId, expectationId: event.expectationId }),
    )
  }
  const observedAt = yield* (yield* ExpectationObservationClock).now(tx)
  const [inserted] = yield* query(() =>
    tx
      .insert(workflowEvents)
      .values({
        eventId,
        runId,
        type: event.type,
        occurredAt: new Date(event.timestamp),
        expectation: event,
        expectationEffective: !duplicate,
        expectationOwnerId: ownerId,
        expectationObservedAt: observedAt,
      })
      .returning({ id: workflowEvents.id }),
  )
  if (duplicate) {
    return "duplicate"
  }
  const change =
    event.type === "expectation_declared"
      ? {
          declarationEventId: inserted!.id,
          declaredAt: observedAt,
          deadlineAt: new Date(observedAt.getTime() + event.withinMs),
        }
      : {
          settlementEventId: inserted!.id,
          settledAt: observedAt,
          settlementType: event.type,
        }
  yield* query(() =>
    tx
      .update(workflowExpectations)
      .set(change)
      .where(eq(workflowExpectations.id, ownerId)),
  )
  return "recorded"
})
