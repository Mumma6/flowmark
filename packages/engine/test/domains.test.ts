import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { Effect, Schema } from "effect"
import {
  Engine,
  ComparisonInputSchema,
  ComparisonSchema,
  DirectedGraphSchema,
} from "../src/index.js"

const comparisonFixtures = Schema.decodeUnknownSync(
  Schema.fromJsonString(
    Schema.Array(
      Schema.Struct({
        name: Schema.String,
        input: ComparisonInputSchema,
        expected: ComparisonSchema,
      }),
    ),
  ),
)(
  readFileSync(
    new URL(
      "../../../crates/flowmark-engine/tests/fixtures/comparisons.json",
      import.meta.url,
    ),
    "utf8",
  ),
)
const graphFixtures = Schema.decodeUnknownSync(
  Schema.fromJsonString(
    Schema.Array(
      Schema.Struct({
        name: Schema.String,
        input: DirectedGraphSchema,
        expected: Schema.Boolean,
      }),
    ),
  ),
)(
  readFileSync(
    new URL(
      "../../../crates/flowmark-engine/tests/fixtures/graphs.json",
      import.meta.url,
    ),
    "utf8",
  ),
)

describe("compiled engine domain fixtures", () => {
  it.each(comparisonFixtures)(
    "preserves peer comparisons: $name",
    async ({ input, expected }) => {
      const before = JSON.stringify(input)
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          return yield* (yield* Engine).compareSummaries(input)
        }).pipe(Effect.provide(Engine.layer)),
      )
      expect(result).toEqual(expected)
      expect(JSON.stringify(input)).toBe(before)
    },
  )
  it.each(graphFixtures)(
    "preserves directed cycles: $name",
    async ({ input, expected }) => {
      const before = JSON.stringify(input)
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          return yield* (yield* Engine).hasCycle(input)
        }).pipe(Effect.provide(Engine.layer)),
      )
      expect(result).toBe(expected)
      expect(JSON.stringify(input)).toBe(before)
    },
  )
})
