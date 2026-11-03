import assert from "node:assert/strict"
import { test } from "node:test"
import { Array, Schema } from "effect"
import { EventEnvelopeSchema } from "@flowmarkdev/core"
import { generate, summarize } from "../src/generator/generate.js"
import { workflowNames } from "../src/scenarios/catalog.js"

const config = {
  reference: "2026-11-03T12:00:00.000Z",
  seed: "meridian-health-2026-v1",
}
const data = generate(config)
const envelopes = Array.flatMap(data.runs, (run) => [...run.events])

test("the complete 30-day dataset is deterministic, bounded and uses the existing event contract", () => {
  assert.deepEqual(generate(config), data)
  assert.notEqual(
    generate({ ...config, seed: "another-seed" }).configHash,
    data.configHash,
  )
  assert.deepEqual(
    new Set(data.runs.map((run) => run.workflow)),
    new Set(workflowNames),
  )
  assert.equal(
    new Set(envelopes.map((item) => item.eventId)).size,
    envelopes.length,
  )
  assert.equal(
    new Set(data.runs.map((run) => run.runId)).size,
    data.runs.length,
  )
  assert.ok(data.runs.length > 1500 && data.runs.length < 5000)
  assert.ok(envelopes.every(Schema.is(EventEnvelopeSchema)))
  assert.ok(
    envelopes.every(
      ({ event }) =>
        Date.parse(event.timestamp) <= Date.parse(config.reference),
    ),
  )
  assert.ok(
    envelopes.every(
      ({ event }) =>
        Date.parse(event.timestamp) >=
        Date.parse(config.reference) - 30 * 86400000,
    ),
  )
  assert.equal(summarize(data).events, envelopes.length)
})

test("run and operation lifecycle ordering, duration and parent/retry references agree", () => {
  const ids = new Set(data.runs.map((run) => run.runId))
  Array.forEach(data.runs, (run) => {
    const events = run.events.map(({ event }) => event)
    assert.equal(events[0]?.type, "started")
    const started = events[0]!
    if (started.type !== "started") {
      return
    }
    if (started.parentRunId) {
      assert.ok(ids.has(started.parentRunId))
    }
    if (started.retryOf) {
      assert.ok(
        data.runs.some(
          (item) =>
            item.runId === started.retryOf!.runId &&
            item.workflow === started.retryOf!.workflow,
        ),
      )
    }
    const terminalIndex = events.findIndex(
      (event) => event.type === "completed" || event.type === "failed",
    )
    Array.forEach(events, (event, index) => {
      if (index) {
        assert.ok(
          Date.parse(event.timestamp) >=
            Date.parse(events[index - 1]!.timestamp),
          `${run.runId}: ${event.type}`,
        )
      }
      if (terminalIndex >= 0 && index > terminalIndex) {
        assert.equal(event.type, "expectation_resolved")
      }
      if (
        event.type === "operation_completed" ||
        event.type === "operation_failed"
      ) {
        const operation = events.find(
          (item) =>
            item.type === "operation_started" &&
            item.operationId === event.operationId,
        )
        assert.ok(operation)
        assert.equal(
          event.durationMs,
          Date.parse(event.timestamp) - Date.parse(operation.timestamp),
        )
      }
    })
  })
  assert.ok(
    data.runs.some(
      (run) =>
        !run.events.some(
          ({ event }) => event.type === "completed" || event.type === "failed",
        ),
    ),
  )
  assert.ok(
    envelopes.some(({ event }) => event.type === "started" && event.retryOf),
  )
  assert.ok(
    envelopes.some(
      ({ event }) =>
        event.type === "operation_started" && event.attempt?.number === 2,
    ),
  )
})

test("reported counts reconcile and unknown fields remain absent", () => {
  const completed = envelopes.flatMap(({ event }) =>
    event.type === "completed" && event.result ? [event] : [],
  )
  Array.forEach(completed, (event) => {
    const result = event.result!
    if (event.workflow === "referral.ingest") {
      assert.equal(
        result.received,
        Number(result.accepted) +
          Number(result.rejected) +
          Number(result.review) +
          Number(result.duplicates),
      )
      const reasons = result.reasons as Record<string, number>
      assert.equal(
        Number(result.rejected),
        reasons.missing_clinic! + reasons.missing_contact!,
      )
    }
    if (event.workflow === "lab-results.sync") {
      assert.equal(
        result.received,
        Number(result.synchronized) +
          Number(result.rejected) +
          Number(result.delayed),
      )
    }
    if (event.outcome === "pending_confirmation") {
      assert.equal("confirmed" in result, false)
    }
  })
  assert.ok(
    completed.some(
      (event) =>
        event.outcome === "no_availability" && event.result!.confirmed === 0,
    ),
  )
  assert.ok(
    completed.some(
      (event) =>
        event.workflow === "referral.ingest" && event.outcome === "partial",
    ),
  )
  const byPhase = (phase: string) =>
    data.runs.filter(
      (run) =>
        run.workflow === "referral.ingest" &&
        run.events[0]!.event.type === "started" &&
        run.events[0]!.event.properties?.incidentPhase === phase &&
        run.events[0]!.event.properties?.provider === "cedar-health",
    )
  const rejectionRate = (runs: typeof data.runs) => {
    const results = runs.flatMap((run) =>
      run.events.flatMap(({ event }) =>
        event.type === "completed" && event.result ? [event.result] : [],
      ),
    )
    return (
      results.reduce((sum, result) => sum + Number(result.rejected), 0) /
      results.reduce((sum, result) => sum + Number(result.received), 0)
    )
  }
  assert.ok(
    rejectionRate(byPhase("data-quality")) >
      rejectionRate(byPhase("baseline")) * 5,
  )
})
