import { sql } from "drizzle-orm"
import { Array, Effect, Option } from "effect"
import {
  LINKED_COMPARISON_BOUNDS,
  type LinkedComparisonQuery,
} from "@flowmarkdev/core"
import {
  Database,
  type DatabaseError,
  InvalidResultQuery,
} from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import {
  runTransaction,
  type DatabaseTransaction,
} from "../../run-transaction.js"
import { getResultDeclaration } from "../../result-declarations/queries/get-result-declaration.js"
import { getSearchFields } from "../../result-declarations/queries/get-search-fields.js"
import { linkedReadBudgetSql } from "../sql/linked-comparison.js"
import { declaredResultField } from "./validate-result-query.js"

interface LinkedReadMetadata {
  readonly query: LinkedComparisonQuery
  readonly numeratorLabel: string
  readonly denominatorLabel: string
}

/** Consistent bounded retained population, with deadlines even for raw-event fallback. */
export const readLinkedComparison = Effect.fn("readLinkedComparison")(
  function* <A>(
    projectId: string,
    query: LinkedComparisonQuery,
    use: (
      tx: DatabaseTransaction,
      metadata: LinkedReadMetadata,
    ) => Effect.Effect<A, DatabaseError | InvalidResultQuery>,
  ) {
    const upstream = yield* getResultDeclaration(
      projectId,
      query.upstreamWorkflow,
      query.upstreamRevision,
    )
    if (Option.isNone(upstream)) {
      return yield* new InvalidResultQuery({
        message: "Select a declared upstream revision.",
      })
    }
    const fields = yield* Effect.all(
      {
        numerator: declaredResultField(
          projectId,
          query.downstreamWorkflow,
          query.downstreamRevision,
          query.numerator,
        ),
        denominator: declaredResultField(
          projectId,
          query.downstreamWorkflow,
          query.downstreamRevision,
          query.denominator,
        ),
      },
      { concurrency: 2 },
    )
    if (
      Array.some(
        [fields.numerator, fields.denominator],
        (field) => field.kind !== "count" || !field.aggregate,
      )
    ) {
      return yield* new InvalidResultQuery({
        message:
          "Both downstream metrics must be declared aggregatable count fields.",
      })
    }
    if (query.businessKey !== undefined) {
      const configured = yield* getSearchFields(
        projectId,
        query.upstreamWorkflow,
      )
      if (
        !Array.some(
          configured,
          (field) =>
            field.role === "dimension" &&
            field.key === query.businessKey &&
            Array.contains(field.values, query.businessValue ?? ""),
        )
      ) {
        return yield* new InvalidResultQuery({
          message: "Select a configured upstream dimension and value.",
        })
      }
    }
    const db = yield* Database
    return yield* runTransaction(
      DatabaseOperation.ReadLinkedComparison,
      (body) =>
        db.transaction(body, {
          isolationLevel: "repeatable read",
          accessMode: "read only",
        }),
      (tx) =>
        Effect.gen(function* () {
          yield* runQuery(DatabaseOperation.ReadLinkedComparison, () =>
            tx.execute(
              sql`SELECT set_config('statement_timeout', ${String(LINKED_COMPARISON_BOUNDS.statementTimeoutMs)}, true)`,
            ),
          )
          const budgets = yield* runQuery(
            DatabaseOperation.ReadLinkedComparison,
            () =>
              tx.execute<{ maximumAnchors: number; fallbackEvents: number }>(
                linkedReadBudgetSql(projectId, query),
              ),
          )
          const budget = Option.getOrThrow(Array.head(budgets))
          if (
            budget.maximumAnchors >
              LINKED_COMPARISON_BOUNDS.maximumAnchorsPerWindow ||
            budget.fallbackEvents >
              LINKED_COMPARISON_BOUNDS.maximumFallbackEvents
          ) {
            return yield* new InvalidResultQuery({
              message: `This retained population exceeds the linked comparison read budget (${LINKED_COMPARISON_BOUNDS.maximumAnchorsPerWindow} anchors per window; ${LINKED_COMPARISON_BOUNDS.maximumFallbackEvents} fallback events). Choose a narrower window or dimension.`,
            })
          }
          return yield* use(tx, {
            query,
            numeratorLabel: fields.numerator.label,
            denominatorLabel: fields.denominator.label,
          })
        }),
    )
  },
)
