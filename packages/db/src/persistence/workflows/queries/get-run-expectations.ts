import { validExpectationProjectionSql } from "../sql/expectations.js"
import { sql } from "drizzle-orm"
import { Effect } from "effect"
import {
  expectationState,
  type RunExpectations,
  type ExpectationRecord,
  type ExpectationEvent,
} from "@flowmarkdev/core"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { ExpectationObservationClock } from "../observation-clock.js"

type Row = {
  outOfOrder: boolean | null
  workflow: string
  externalId: string
  expectationId: string
  declaredAt: string | null
  deadlineAt: string | null
  settledAt: string | null
  settlementType: string | null
  declarationId: string | null
  declaration: ExpectationEvent | null
  settlementId: string | null
  settlement: ExpectationEvent | null
}
export const getRunExpectations = Effect.fn("getRunExpectations")(function* (
  projectId: string,
  runId: string,
) {
  const db = yield* Database
  const clock = yield* ExpectationObservationClock
  return yield* runQuery(DatabaseOperation.ReadExpectations, () =>
    db.transaction(
      (tx) =>
        Effect.runPromise(
          Effect.gen(function* () {
            const asOf = (yield* clock.now(tx)).toISOString()
            const rows = yield* runQuery(
              DatabaseOperation.ReadExpectations,
              () =>
                tx.execute<Row>(sql`
      SELECT w.name as workflow, r.external_id as "externalId", x.expectation_id as "expectationId",
        x.declared_at::text as "declaredAt", x.deadline_at::text as "deadlineAt", x.settled_at::text as "settledAt", x.settlement_type as "settlementType",
        (s.receipt_order < d.receipt_order) as "outOfOrder", d.event_id as "declarationId", d.expectation as declaration, s.event_id as "settlementId", s.expectation as settlement
      FROM workflow_expectations x JOIN workflow_runs r ON r.id = x.run_id JOIN workflows w ON w.id = r.workflow_id
      LEFT JOIN workflow_events d ON d.id = x.declaration_event_id LEFT JOIN workflow_events s ON s.id = x.settlement_event_id
      WHERE w.project_id = ${projectId} AND r.id = ${runId} AND ${validExpectationProjectionSql} ORDER BY x.declared_at NULLS LAST, x.expectation_id LIMIT 100
    `),
            )
            const [integrity] = yield* runQuery(
              DatabaseOperation.ReadExpectations,
              () =>
                tx.execute<{ count: number }>(sql`
      SELECT count(DISTINCT e.expectation->>'expectationId')::int as count FROM workflow_events e
      JOIN workflow_runs r ON r.id = e.run_id JOIN workflows w ON w.id = r.workflow_id
      WHERE w.project_id = ${projectId} AND r.id = ${runId} AND e.expectation IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM workflow_expectations x WHERE x.run_id = r.id AND x.expectation_id = e.expectation->>'expectationId' AND ${validExpectationProjectionSql})
    `),
            )
            const records = Array.from(rows).map((row): ExpectationRecord => ({
              reference: {
                version: 1,
                workflow: row.workflow,
                runId: row.externalId,
                expectationId: row.expectationId,
              },
              name:
                row.declaration?.type === "expectation_declared"
                  ? row.declaration.name
                  : null,
              source: row.workflow.startsWith("browser.")
                ? "browser"
                : "server",
              state: expectationState(
                row.deadlineAt,
                row.settlementType,
                row.settledAt,
                asOf,
              ),
              declaredAt:
                row.declaredAt === null
                  ? null
                  : new Date(row.declaredAt).toISOString(),
              deadlineAt:
                row.deadlineAt === null
                  ? null
                  : new Date(row.deadlineAt).toISOString(),
              settledAt:
                row.settledAt === null
                  ? null
                  : new Date(row.settledAt).toISOString(),
              declaration:
                row.declaration && row.declarationId
                  ? { eventId: row.declarationId, event: row.declaration }
                  : null,
              settlement:
                row.settlement && row.settlementId
                  ? { eventId: row.settlementId, event: row.settlement }
                  : null,
              outOfOrder: row.outOfOrder ?? false,
              cancelledAfterDeadline:
                row.settlementType === "expectation_cancelled" &&
                row.deadlineAt !== null &&
                row.settledAt !== null &&
                Date.parse(row.settledAt) > Date.parse(row.deadlineAt),
            }))
            return {
              asOf,
              expectations: records.filter((r) => r.state !== "unmatched"),
              unmatched: records.filter((r) => r.state === "unmatched"),
              unavailableCount: integrity?.count ?? 0,
            } satisfies RunExpectations
          }),
        ),
      { isolationLevel: "repeatable read" },
    ),
  )
})
