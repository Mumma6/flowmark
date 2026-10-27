import { Effect } from "effect"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import {
  failureCodeAttributionSql,
  intelligenceWindowSql,
  operationAttributionSql,
} from "../sql/insights.js"
import type {
  FailureCodeAttribution,
  IntelligenceQuery,
  InsightWindow,
  OperationAttribution,
  WorkflowIntelligence,
} from "../types.js"

type WindowRow = InsightWindow & {
  readonly period: "current" | "previous"
}

type OperationRow = {
  readonly period: "current" | "previous"
  readonly name: string
  readonly runCount: number
  readonly medianDurationMs: number | null
  readonly runIds: ReadonlyArray<string> | null
}

type FailureCodeRow = {
  readonly period: "current" | "previous"
  readonly code: string
  readonly count: number
  readonly runIds: ReadonlyArray<string> | null
}

const emptyWindow = (
  startedAfter: string,
  startedBefore: string,
): InsightWindow => ({
  startedAfter,
  startedBefore,
  totalRuns: 0,
  finishedRuns: 0,
  completedRuns: 0,
  failedRuns: 0,
  successRate: null,
  medianDurationMs: null,
  p95DurationMs: null,
})

const runIds = (value: ReadonlyArray<string> | null) =>
  (value ?? []).slice(0, 20)

export const getWorkflowIntelligence = Effect.fn("getWorkflowIntelligence")(
  function* (projectId: string, query: IntelligenceQuery) {
    const db = yield* Database
    const current = {
      startedAfter: query.currentStartedAfter,
      startedBefore: query.currentStartedBefore,
    }
    const previous = {
      startedAfter: query.previousStartedAfter,
      startedBefore: query.previousStartedBefore,
    }

    const windows = yield* runQuery(
      DatabaseOperation.ReadWorkflowIntelligence,
      () =>
        db.execute<WindowRow>(
          intelligenceWindowSql(projectId, query.workflow, current, previous),
        ),
    )
    const operationRows = yield* runQuery(
      DatabaseOperation.ReadWorkflowIntelligence,
      () =>
        db.execute<OperationRow>(
          operationAttributionSql(projectId, query.workflow, current, previous),
        ),
    )
    const failureRows = yield* runQuery(
      DatabaseOperation.ReadWorkflowIntelligence,
      () =>
        db.execute<FailureCodeRow>(
          failureCodeAttributionSql(
            projectId,
            query.workflow,
            current,
            previous,
          ),
        ),
    )

    const windowByPeriod = new Map(windows.map((row) => [row.period, row]))
    const currentWindow =
      windowByPeriod.get("current") ??
      emptyWindow(current.startedAfter, current.startedBefore)
    const previousWindow =
      windowByPeriod.get("previous") ??
      emptyWindow(previous.startedAfter, previous.startedBefore)

    const operationsByName = new Map<
      string,
      {
        current?: OperationRow
        previous?: OperationRow
      }
    >()
    for (const row of operationRows) {
      const entry = operationsByName.get(row.name) ?? {}
      entry[row.period] = row
      operationsByName.set(row.name, entry)
    }

    const operations: OperationAttribution[] = [...operationsByName.entries()]
      .map(([name, rows]) => {
        const currentRow = rows.current
        const previousRow = rows.previous
        const currentMedian = currentRow?.medianDurationMs ?? null
        const previousMedian = previousRow?.medianDurationMs ?? null
        return {
          name,
          currentRunCount: currentRow?.runCount ?? 0,
          previousRunCount: previousRow?.runCount ?? 0,
          currentMedianDurationMs: currentMedian,
          previousMedianDurationMs: previousMedian,
          durationDeltaMs:
            currentMedian == null || previousMedian == null
              ? null
              : currentMedian - previousMedian,
          currentRunIds: runIds(currentRow?.runIds ?? null),
          previousRunIds: runIds(previousRow?.runIds ?? null),
        }
      })
      .sort(
        (left, right) =>
          Math.abs(right.durationDeltaMs ?? 0) -
            Math.abs(left.durationDeltaMs ?? 0) ||
          right.currentRunCount - left.currentRunCount,
      )

    const failureCodesByCode = new Map<
      string,
      {
        current?: FailureCodeRow
        previous?: FailureCodeRow
      }
    >()
    for (const row of failureRows) {
      const entry = failureCodesByCode.get(row.code) ?? {}
      entry[row.period] = row
      failureCodesByCode.set(row.code, entry)
    }

    const failureCodes: FailureCodeAttribution[] = [
      ...failureCodesByCode.entries(),
    ]
      .map(([code, rows]) => {
        const currentCount = rows.current?.count ?? 0
        const previousCount = rows.previous?.count ?? 0
        return {
          code,
          currentCount,
          previousCount,
          countDelta: currentCount - previousCount,
          currentRunIds: runIds(rows.current?.runIds ?? null),
          previousRunIds: runIds(rows.previous?.runIds ?? null),
        }
      })
      .sort(
        (left, right) =>
          Math.abs(right.countDelta) - Math.abs(left.countDelta) ||
          right.currentCount - left.currentCount,
      )

    return {
      workflow: query.workflow ?? null,
      current: currentWindow,
      previous: previousWindow,
      operations,
      failureCodes,
    } satisfies WorkflowIntelligence
  },
)
