import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { Effect, Schema } from "effect"
import {
  EvidenceEngine,
  OperationEventSchema,
  OperationSummarySchema,
} from "../src/index.js"

const Fixture = Schema.Struct({
  name: Schema.String,
  events: Schema.Array(OperationEventSchema),
  expected: Schema.Array(OperationSummarySchema),
})
const fixtures = Schema.decodeUnknownSync(
  Schema.fromJsonString(Schema.Array(Fixture)),
)(
  readFileSync(
    new URL(
      "../../../crates/flowmark-evidence/tests/fixtures/operations.json",
      import.meta.url,
    ),
    "utf8",
  ),
)
const run = <A, E>(effect: Effect.Effect<A, E, EvidenceEngine>) =>
  Effect.runPromise(effect.pipe(Effect.provide(EvidenceEngine.layer)))

describe("compiled Rust operation evidence", () => {
  it.each(fixtures)(
    "preserves legacy behavior: $name",
    async ({ events, expected }) => {
      await expect(
        run(
          Effect.gen(function* () {
            return yield* (yield* EvidenceEngine).summarizeOperations(events)
          }),
        ),
      ).resolves.toEqual(expected)
    },
  )
  it("preserves the input and reuses initialized bindings across concurrent calls", async () => {
    const { events, expected } = fixtures[1]
    const before = JSON.stringify(events)
    const { loadBindings } = await import("../src/loader.js")
    const [first, second] = await Promise.all([
      Effect.runPromise(loadBindings()),
      Effect.runPromise(loadBindings()),
    ])
    expect(first).toBe(second)
    const results = await run(
      Effect.gen(function* () {
        const engine = yield* EvidenceEngine
        return yield* Effect.all(
          [
            engine.summarizeOperations(events),
            engine.summarizeOperations(events),
          ],
          { concurrency: 2 },
        )
      }),
    )
    expect(results).toEqual([expected, expected])
    expect(JSON.stringify(events)).toBe(before)
  })
  it("interpolates percentiles and keeps empty samples unknown", async () => {
    await expect(
      run(
        Effect.gen(function* () {
          const engine = yield* EvidenceEngine
          return yield* Effect.all([
            engine.percentile([], 0.5),
            engine.percentile([7], 0.95),
            engine.percentile([10, 0], 0.95),
            engine.percentile([4, 1, 3, 2], 0.5),
          ])
        }),
      ),
    ).resolves.toEqual([null, 7, 9.5, 2.5])
  })
  it.each([NaN, Infinity, -Infinity])(
    "rejects invalid durations %s before JSON can turn them into null",
    async (durationMs) => {
      const result = await run(
        Effect.gen(function* () {
          const engine = yield* EvidenceEngine
          return yield* Effect.result(
            engine.summarizeOperations([
              {
                type: "operation_completed",
                operationId: "a",
                operationName: "work",
                durationMs,
                timestamp: "unused",
              },
            ]),
          )
        }),
      )
      expect(result).toMatchObject({
        _tag: "Failure",
        failure: { _tag: "EvidenceEngineError", stage: "input" },
      })
    },
  )
  it("reports an invalid percentile and numeric overflow as calculation failures", async () => {
    const results = await run(
      Effect.gen(function* () {
        const engine = yield* EvidenceEngine
        return yield* Effect.all([
          Effect.result(engine.percentile([], 2)),
          Effect.result(
            engine.summarizeOperations(
              ["a", "b"].map((operationId) => ({
                type: "operation_completed",
                operationId,
                operationName: "work",
                durationMs: Number.MAX_VALUE,
                timestamp: "unused",
              })),
            ),
          ),
        ])
      }),
    )
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _tag: "Failure",
          failure: expect.objectContaining({ stage: "calculation" }),
        }),
      ]),
    )
    expect(results.every((r) => r._tag === "Failure")).toBe(true)
  })
})
