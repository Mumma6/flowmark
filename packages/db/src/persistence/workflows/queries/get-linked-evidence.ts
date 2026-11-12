import { Array, Effect, Option, Result } from "effect"
import {
  LINKED_COMPARISON_BOUNDS,
  LINKED_COMPARISON_CAVEAT,
  type LinkedEvidenceQuery,
  type LinkedEvidencePage,
  type LinkedEvidenceRow,
} from "@flowmarkdev/core"
import { InvalidResultQuery } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import {
  decodeLinkedComparisonCursor,
  encodeLinkedComparisonCursor,
} from "../linked-comparison-cursor.js"
import { linkedEvidenceSql } from "../sql/linked-comparison.js"
import { readLinkedComparison } from "./read-linked-comparison.js"

export const getLinkedEvidence = Effect.fn("getLinkedEvidence")(function* (
  projectId: string,
  input: LinkedEvidenceQuery,
) {
  const after = yield* Option.match(Option.fromUndefinedOr(input.cursor), {
    onNone: () => Effect.succeed(undefined),
    onSome: () =>
      Result.match(decodeLinkedComparisonCursor(projectId, input), {
        onFailure: () =>
          Effect.fail(
            new InvalidResultQuery({
              message: "Invalid linked comparison cursor or selection.",
            }),
          ),
        onSuccess: (cursor) => Effect.succeed(cursor),
      }),
  })
  return yield* readLinkedComparison(projectId, input.query, (tx) =>
    Effect.gen(function* () {
      const limit = input.limit ?? 25
      const results = yield* runQuery(
        DatabaseOperation.ReadLinkedEvidence,
        () =>
          tx.execute<{
            total: number
            rows: LinkedEvidenceRow[]
            cursorValid: boolean
          }>(
            linkedEvidenceSql(projectId, input.query, {
              ...input,
              limit,
              after,
            }),
          ),
      )
      const page = Option.getOrThrow(Array.head(results))
      if (!page.cursorValid) {
        return yield* new InvalidResultQuery({
          message:
            "The evidence cursor no longer belongs to this retained selection. Restart evidence paging.",
        })
      }
      const visible = Array.take(page.rows, limit)
      const last = Array.last(visible)
      return {
        query: input,
        total: page.total,
        rows: visible,
        nextCursor:
          page.rows.length > limit
            ? Option.match(last, {
                onNone: () => null,
                onSome: (row) =>
                  encodeLinkedComparisonCursor(projectId, input, row.anchor),
              })
            : null,
        bounds: LINKED_COMPARISON_BOUNDS,
        caveat: LINKED_COMPARISON_CAVEAT,
      } satisfies LinkedEvidencePage
    }),
  )
})
