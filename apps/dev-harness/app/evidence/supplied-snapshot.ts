import type { RunSnapshotProps } from "@flowmark/ui"
import { Array, HashSet, Schema, pipe } from "effect"

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

export const exampleSnapshot = {
  workflow: "synthetic.customer-import",
  externalId: "Internal run: synthetic-run-1",
  startedAt: "2026-11-10T09:00:00.000Z",
  duration: "Not reported",
  status: "No final outcome",
  metrics: [],
  milestones: [
    {
      id: "synthetic-event-1",
      label: "progress",
      kind: "progress",
      time: "2026-11-10T09:00:01.000Z",
      title: "Recorded progress event",
      description:
        "Synthetic example. Progress values and application payload are withheld.",
      payload: '{"id":"synthetic-event-1","type":"progress"}',
      note: "Event reference: synthetic-event-1",
    },
  ],
  emptyResult:
    "Business result, external ID and raw payloads are withheld. No terminal outcome was supplied.",
  evidenceNote:
    "Synthetic example · Project reference: synthetic-project. Run reference: synthetic-run-1. Showing 1 of 2 events in one page; 12 events recorded. Other pages omitted. Supplied evidence, not a live view.",
} satisfies Omit<RunSnapshotProps, "actions">
