import { Effect, Schema } from "effect"
import { describe, expect, it, vi } from "vitest"
import { WorkflowResultSchema } from "@flowmarkdev/core"
import { MemoryTransport, workflow } from "../src/index.js"

// Synthetic TASK-001 contract references only. These are not SDK exports or
// claims that outcome/report events are accepted by current ingestion.
const ProposedOutcome = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[a-z][a-z0-9_-]{0,63}$/)),
)
const proposedReports = [
  { checked: 200, mismatches: 3 },
  { checked: 400 },
] as const

const recordSynthetic = Effect.fn("ResultContract.recordSynthetic")(function* (
  name: string,
  record: (flow: ReturnType<typeof workflow>) => void,
  expectedEvents = 2,
) {
  const transport = new MemoryTransport()
  const flow = workflow(name, {
    id: `synthetic-${name}`,
    properties: { synthetic: true },
    transport,
  })
  record(flow)
  // Wait for asynchronous in-memory delivery; no network or database writes.
  yield* Effect.promise(() =>
    vi.waitFor(() => expect(transport.events).toHaveLength(expectedEvents)),
  )
  return transport.events
})

describe("synthetic outcome/report contract references", () => {
  it.each(["complete", "partial", "unavailable", "rejected"])(
    "accepts the proposed outcome code %s",
    (code) => expect(Schema.is(ProposedOutcome)(code)).toBe(true),
  )

  it.each(["", " ", "Partial", "has space", "a".repeat(65)])(
    "rejects invalid proposed outcome %j",
    (code) => expect(Schema.is(ProposedOutcome)(code)).toBe(false),
  )

  it("records clean and partial imports as technical completions", () =>
    Effect.runPromise(
      Effect.forEach(
        [
          { outcome: "complete", imported: 10000, skipped: 0, rejected: 0 },
          { outcome: "partial", imported: 9600, skipped: 300, rejected: 100 },
        ],
        (result) =>
          recordSynthetic(
            "customer.import",
            (flow) => {
              flow.progress({ completed: 6000, total: 10000, unit: "rows" })
              flow.done({ result: { ...result, inputRows: 10000 } })
            },
            3,
          ).pipe(
            Effect.tap((events) =>
              Effect.sync(() => {
                expect(events.map(({ type }) => type)).toEqual([
                  "started",
                  "progress",
                  "completed",
                ])
                expect(events.at(-1)).toMatchObject({ result })
                // Legacy JSON is preserved, never a canonical event field.
                expect(events.at(-1)).not.toHaveProperty("outcome")
              }),
            ),
          ),
      ),
    ))

  it("preserves useful committed CRM work on technical failure", () =>
    Effect.runPromise(
      recordSynthetic(
        "crm.sync",
        (flow) => {
          flow.progress({ completed: 400, total: 600, unit: "updates" })
          flow.fail({
            code: "CRM_TIMEOUT",
            result: { outcome: "partial", updated: 400, expected: 600 },
          })
        },
        3,
      ).pipe(
        Effect.tap((events) =>
          Effect.sync(() => {
            expect(events.at(-1)).toMatchObject({
              type: "failed",
              failure: { code: "CRM_TIMEOUT" },
              result: { updated: 400, expected: 600 },
            })
          }),
        ),
      ),
    ))

  it("distinguishes legitimate booking unavailability from awaiting callback", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const unavailable = yield* recordSynthetic(
          "booking.unavailable",
          (flow) =>
            flow.done({
              result: { outcome: "unavailable", reserved: 0, requested: 1 },
            }),
        )
        const awaiting = yield* recordSynthetic("booking.awaiting", (flow) =>
          flow.step("awaiting-callback"),
        )
        expect(unavailable.at(-1)).toMatchObject({
          type: "completed",
          result: { reserved: 0 },
        })
        expect(awaiting.map(({ type }) => type)).toEqual(["started", "step"])
      }),
    ))

  it("keeps interrupted recurring work nonterminal", () =>
    Effect.runPromise(
      recordSynthetic("ledger.reconcile", (flow) =>
        flow.progress({ completed: 400, unit: "entries" }),
      ).pipe(
        Effect.tap((events) =>
          Effect.sync(() => {
            expect(events.map(({ type }) => type)).toEqual([
              "started",
              "progress",
            ])
            expect(events.at(-1)).not.toHaveProperty("result")
          }),
        ),
      ),
    ))

  it("distinguishes unknown investigation results from explicit empty results", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const unknown = yield* recordSynthetic("case.unknown", (flow) =>
          flow.done(),
        )
        const empty = yield* recordSynthetic("case.empty", (flow) =>
          flow.done({ result: {} }),
        )
        expect(unknown.at(-1)).not.toHaveProperty("result")
        expect(empty.at(-1)).toMatchObject({ result: {} })
      }),
    ))

  it("defines replacement snapshots without retaining omitted fields or finalizing", () => {
    for (const snapshot of proposedReports) {
      expect(Schema.is(WorkflowResultSchema)(snapshot)).toBe(true)
    }
    const latest = proposedReports.at(-1)
    expect(latest).toEqual({ checked: 400 })
    expect(latest).not.toHaveProperty("mismatches")
    // Final results are explicit independent facts, never inferred from reports.
    const interrupted = { latestReport: latest, finalResult: undefined }
    expect(interrupted.finalResult).toBeUndefined()
    const reconciled = { latestReport: latest, finalResult: { checked: 390 } }
    expect(reconciled.latestReport).toEqual({ checked: 400 })
    expect(reconciled.finalResult).toEqual({ checked: 390 })
    expect(Schema.is(WorkflowResultSchema)(null)).toBe(false)
    expect(Schema.is(WorkflowResultSchema)({ checked: Infinity })).toBe(false)
  })
})
