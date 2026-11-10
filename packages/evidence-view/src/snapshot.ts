import * as Array from "effect/Array"
import * as HashSet from "effect/HashSet"
import * as Schema from "effect/Schema"
import { pipe } from "effect/Function"

const text = Schema.String.check(Schema.isMaxLength(8192))
const nullableText = Schema.optional(Schema.NullOr(text))
const metric = Schema.Struct({ label: text, value: text, note: text })
const milestone = Schema.Struct({
  id: text.check(Schema.isMinLength(1)),
  label: text,
  time: text,
  kind: Schema.Literals([
    "checkpoint",
    "progress",
    "error",
    "completed",
    "failed",
  ]),
  title: text,
  description: text,
  payload: text,
  note: text,
  progress: Schema.optional(
    Schema.Struct({
      completed: Schema.Number.check(
        Schema.isFinite(),
        Schema.isGreaterThanOrEqualTo(0),
      ),
      total: Schema.optional(
        Schema.NullOr(
          Schema.Number.check(
            Schema.isFinite(),
            Schema.isGreaterThanOrEqualTo(0),
          ),
        ),
      ),
      unit: nullableText,
    }),
  ),
})
const snapshot = Schema.Struct({
  workflow: text,
  externalId: text,
  startedAt: text,
  duration: text,
  environment: nullableText,
  release: nullableText,
  status: Schema.Literals(["Completed", "Failed", "No final outcome"]),
  metrics: Schema.Array(metric).check(Schema.isMaxLength(4)),
  milestones: Schema.Array(milestone).check(
    Schema.isMaxLength(8),
    Schema.makeFilter(
      (items) =>
        pipe(
          items,
          Array.map((item) => item.id),
          HashSet.fromIterable,
          HashSet.size,
        ) === items.length,
    ),
  ),
  emptyResult: text,
  evidenceNote: text.check(Schema.isMinLength(1)),
})

/** Untrusted pasted JSON is data, never executable actions, URLs or authority. */
export const decodeSuppliedSnapshot = Schema.decodeUnknownResult(
  Schema.String.check(Schema.isMaxLength(65536)).pipe(
    Schema.decodeTo(Schema.fromJsonString(snapshot)),
  ),
  { onExcessProperty: "error" },
)
