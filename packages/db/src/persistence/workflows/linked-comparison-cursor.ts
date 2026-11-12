import { createHash } from "node:crypto"
import { Result, Schema } from "effect"
import type { LinkedEvidenceQuery } from "@flowmarkdev/core"

const Cursor = Schema.Struct({
  version: Schema.Literal(1),
  projectId: Schema.String.check(Schema.isGUID()),
  scope: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  id: Schema.String.check(Schema.isGUID()),
  // Preserve SQL microseconds instead of truncating through a JavaScript Date.
  startedAt: Schema.String.check(
    Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/),
    Schema.makeFilter((value) => Number.isFinite(Date.parse(value))),
  ),
})
const scope = (query: LinkedEvidenceQuery) =>
  createHash("sha256")
    .update(
      JSON.stringify([
        query.query.upstreamWorkflow,
        query.query.upstreamRevision,
        query.query.downstreamWorkflow,
        query.query.downstreamRevision,
        query.query.numerator,
        query.query.denominator,
        query.query.currentStartedAfter,
        query.query.currentStartedBefore,
        query.query.previousStartedAfter,
        query.query.previousStartedBefore,
        query.query.businessKey ?? null,
        query.query.businessValue ?? null,
        query.query.releaseA ?? null,
        query.query.releaseB ?? null,
        query.scope,
        query.coverage ?? null,
      ]),
    )
    .digest("hex")

export const encodeLinkedComparisonCursor = (
  projectId: string,
  query: LinkedEvidenceQuery,
  last: { readonly id: string; readonly startedAt: string },
) =>
  JSON.stringify({
    version: 1,
    projectId,
    scope: scope(query),
    id: last.id,
    startedAt: last.startedAt,
  })

export const decodeLinkedComparisonCursor = (
  projectId: string,
  query: LinkedEvidenceQuery,
) =>
  Schema.decodeUnknownResult(Schema.fromJsonString(Cursor), {
    onExcessProperty: "error",
  })(query.cursor).pipe(
    Result.flatMap((cursor) =>
      cursor.projectId === projectId && cursor.scope === scope(query)
        ? Result.succeed(cursor)
        : Result.fail("Cursor selection does not match."),
    ),
  )
