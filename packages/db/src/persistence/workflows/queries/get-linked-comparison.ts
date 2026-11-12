import { Array, Effect } from "effect"
import {
  LINKED_COMPARISON_BOUNDS,
  LINKED_COMPARISON_CAVEAT,
  linkedComparisonAvailability,
  type LinkedComparison,
  type LinkedComparisonQuery,
  type LinkedComparisonWindow,
} from "@flowmarkdev/core"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { linkedAggregateSql } from "../sql/linked-comparison.js"
import { readLinkedComparison } from "./read-linked-comparison.js"

export const getLinkedComparison = Effect.fn("getLinkedComparison")(function* (
  projectId: string,
  query: LinkedComparisonQuery,
) {
  return yield* readLinkedComparison(projectId, query, (tx, metadata) =>
    Effect.gen(function* () {
      const rows = yield* runQuery(DatabaseOperation.ReadLinkedComparison, () =>
        tx.execute<{ data: LinkedComparisonWindow }>(
          linkedAggregateSql(projectId, query),
        ),
      )
      const windows = Array.map(rows, (row) => row.data)
      return {
        ...metadata,
        windows,
        comparison: linkedComparisonAvailability(windows),
        bounds: LINKED_COMPARISON_BOUNDS,
        caveat: LINKED_COMPARISON_CAVEAT,
      } satisfies LinkedComparison
    }),
  )
})
