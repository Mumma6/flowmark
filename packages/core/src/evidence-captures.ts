import { Array, Match, Schema } from "effect"
const Id = Schema.String.check(Schema.isGUID())
const Text = (max: number) => Schema.String.check(Schema.isMaxLength(max))
const Instant = Text(40).check(
  Schema.makeFilter(
    (value) =>
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString() === value,
  ),
)
const Count = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
  Schema.makeFilter(Number.isSafeInteger),
)
export const CaptureRunSchema = Schema.Struct({
  runId: Id,
  title: Text(120).check(
    Schema.isMinLength(1),
    Schema.makeFilter((value) => value.trim().length > 0),
  ),
})
export type CaptureRun = typeof CaptureRunSchema.Type
export const CapturedRunEvidenceSchema = Schema.Struct({
  version: Schema.Literal(1),
  id: Id,
  creatorId: Text(256),
  projectId: Id,
  sourceRunId: Id,
  title: Text(120).check(Schema.isMinLength(1)),
  capturedAt: Instant,
  expiresAt: Instant,
  coverage: Schema.Literal(
    "Single run observation; raw events, operations and other evidence omitted.",
  ),
  evidence: Schema.Struct({
    projection: Schema.Struct({
      version: Schema.Literal(1),
      depth: Schema.Literal("business"),
      projectId: Id,
      publicationRevision: Count,
      observedAt: Instant,
      withheld: Schema.Array(Text(80)).check(Schema.isMaxLength(20)),
    }),
    data: Schema.Struct({
      kind: Schema.Literal("run"),
      summary: Schema.Struct({
        id: Id,
        workflow: Text(200),
        status: Schema.Literals(["Running", "Completed", "Failed"]),
        outcome: Schema.NullOr(Text(64)),
        startedAt: Instant,
        durationMs: Schema.NullOr(
          Schema.Number.check(
            Schema.isFinite(),
            Schema.isGreaterThanOrEqualTo(0),
          ),
        ),
      }),
      fields: Schema.Array(
        Schema.Struct({
          revision: Text(64),
          path: Schema.Array(Text(128)).check(
            Schema.isMinLength(1),
            Schema.isMaxLength(5),
          ),
          label: Text(80),
          unit: Schema.NullOr(Text(80)),
          kind: Schema.Literals(["count", "category", "reasons"]),
          state: Schema.Literals([
            "available",
            "missing",
            "wrong-type",
            "unknown-category",
          ]),
          value: Schema.Union([
            Schema.Null,
            Count,
            Text(128),
            Schema.Array(
              Schema.Struct({ value: Text(128), count: Count }),
            ).check(Schema.isMaxLength(20)),
          ]),
        }),
      ).check(Schema.isMaxLength(12)),
      references: Schema.Array(
        Schema.Struct({ key: Text(64), value: Text(256) }),
      ).check(Schema.isMaxLength(10)),
    }),
  }),
}).check(
  Schema.makeFilter(
    (value) =>
      value.projectId === value.evidence.projection.projectId &&
      value.sourceRunId === value.evidence.data.summary.id &&
      value.capturedAt === value.evidence.projection.observedAt &&
      Date.parse(value.expiresAt) > Date.parse(value.capturedAt) &&
      Date.parse(value.expiresAt) <= Date.parse(value.capturedAt) + 86400000 &&
      Array.every(value.evidence.data.fields, (field) =>
        field.state !== "available"
          ? field.value === null
          : Match.value(field.kind).pipe(
              Match.when("count", () => typeof field.value === "number"),
              Match.when("category", () => typeof field.value === "string"),
              Match.when("reasons", () => Array.isArray(field.value)),
              Match.exhaustive,
            ),
      ) &&
      new TextEncoder().encode(JSON.stringify(value)).byteLength <= 65536,
  ),
)
export type CapturedRunEvidence = typeof CapturedRunEvidenceSchema.Type
export const captureCoverage =
  "Single run observation; raw events, operations and other evidence omitted." as const
export interface EvidenceCaptureSummary {
  readonly id: string
  readonly capturedAt: string
  readonly title: string | null
  readonly expiresAt: string | null
  readonly reason: UnavailableEvidenceCapture["reason"] | null
  readonly available: boolean
  readonly canDelete: boolean
}
export interface UnavailableEvidenceCapture {
  readonly available: false
  readonly id: string
  readonly capturedAt: string
  readonly reason:
    "Expired" | "PublicationChanged" | "SourceMissing" | "Invalid"
}
export type EvidenceCaptureRead =
  | {
      readonly available: true
      readonly capture: CapturedRunEvidence
      readonly canDelete: boolean
    }
  | UnavailableEvidenceCapture
