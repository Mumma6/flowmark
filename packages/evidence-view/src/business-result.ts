import * as Result from "effect/Result"
import * as Schema from "effect/Schema"
const bounded = (max: number) => Schema.String.check(Schema.isMaxLength(max))
const count = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
)
const instant = bounded(40).check(
  Schema.makeFilter((value) => Number.isFinite(Date.parse(value))),
)
const summary = Schema.Struct({
  id: bounded(64),
  workflow: bounded(200),
  status: Schema.Literals(["Completed", "Failed", "Running"]),
  outcome: Schema.NullOr(bounded(64)),
  startedAt: instant,
  durationMs: Schema.NullOr(
    Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0)),
  ),
})
const field = Schema.Struct({
  revision: bounded(64),
  path: Schema.Array(bounded(128)).check(Schema.isMaxLength(5)),
  label: bounded(80),
  unit: Schema.NullOr(bounded(80)),
  kind: Schema.Literals(["count", "category", "reasons"]),
  state: Schema.Literals([
    "available",
    "missing",
    "wrong-type",
    "unknown-category",
  ]),
  value: Schema.Union([
    Schema.Null,
    count,
    bounded(128),
    Schema.Array(Schema.Struct({ value: bounded(128), count })).check(
      Schema.isMaxLength(20),
    ),
  ]),
})
const evidence = Schema.Struct({
  projection: Schema.Struct({
    version: Schema.Literal(1),
    depth: Schema.Literal("business"),
    projectId: bounded(64),
    publicationRevision: count,
    observedAt: instant,
    withheld: Schema.Array(bounded(80)).check(Schema.isMaxLength(20)),
  }),
  data: Schema.Struct({
    kind: Schema.Literal("run"),
    summary,
    fields: Schema.Array(field).check(Schema.isMaxLength(12)),
    references: Schema.Array(
      Schema.Struct({ key: bounded(64), value: bounded(256) }),
    ).check(Schema.isMaxLength(10)),
  }),
})
const envelope = Schema.Struct({
  isError: Schema.optional(Schema.Boolean),
  structuredContent: Schema.Struct({
    tool: Schema.Literal("get_run"),
    projectId: bounded(64),
    evidence,
  }),
})
const invocation = Schema.Struct({
  projectId: bounded(64),
  runId: bounded(64),
  section: Schema.optional(Schema.Literal("events")),
  limit: Schema.optional(count),
  cursor: Schema.optional(bounded(2048)),
})
export const decodeBusinessResult = (args: unknown, result: unknown) =>
  Result.gen(function* () {
    const requested = yield* Schema.decodeUnknownResult(invocation, {
      onExcessProperty: "error",
    })(args)
    const value = yield* Schema.decodeUnknownResult(envelope)(result)
    if (
      value.isError ||
      requested.cursor !== undefined ||
      requested.projectId !== value.structuredContent.projectId ||
      requested.projectId !==
        value.structuredContent.evidence.projection.projectId ||
      requested.runId !== value.structuredContent.evidence.data.summary.id
    ) {
      return yield* Result.fail(
        "Business evidence does not match its invocation.",
      )
    }
    const supplied = value.structuredContent.evidence
    return {
      kind: "business" as const,
      business: {
        summary: supplied.data.summary,
        fields: supplied.data.fields,
        references: supplied.data.references,
        revision: supplied.projection.publicationRevision,
        observedAt: supplied.projection.observedAt,
      },
      invocation: {
        projectId: requested.projectId,
        runId: requested.runId,
        section: "events" as const,
        limit: requested.limit ?? 50,
      },
      nextCursor: null,
    }
  })
export const isBusinessResult = (value: unknown) =>
  Result.isSuccess(
    Schema.decodeUnknownResult(
      Schema.Struct({
        structuredContent: Schema.Struct({ evidence: Schema.Unknown }),
      }),
    )(value),
  )
