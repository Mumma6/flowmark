import type {
  PeriodReadInput,
  PeriodReadResponse,
  PeriodReadWindow,
} from "@flowmarkdev/core"
import { Array, Effect, Option } from "effect"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { emptyInsightWindow } from "../insight-window.js"
import { intelligenceWindowSql } from "../sql/insights.js"

/** Exactly the two Studio period aggregates: no attribution lists or payloads. */
export const getPeriodRead = Effect.fn("getPeriodRead")(function* (
  projectId: string,
  input: PeriodReadInput,
) {
  const db = yield* Database
  const rows = yield* runQuery(DatabaseOperation.ReadWorkflowIntelligence, () =>
    db.execute<PeriodReadWindow & { period: "current" | "previous" }>(
      intelligenceWindowSql(
        projectId,
        input.workflow,
        {
          startedAfter: input.currentStartedAfter,
          startedBefore: input.currentStartedBefore,
        },
        {
          startedAfter: input.previousStartedAfter,
          startedBefore: input.previousStartedBefore,
        },
      ),
    ),
  )
  const window = (
    period: "current" | "previous",
    startedAfter: string,
    startedBefore: string,
  ): PeriodReadWindow => {
    const row = Array.findFirst(rows, (row) => row.period === period).pipe(
      Option.getOrElse(() => emptyInsightWindow(startedAfter, startedBefore)),
    )
    return {
      startedAfter,
      startedBefore,
      totalRuns: row.totalRuns,
      finishedRuns: row.finishedRuns,
      completedRuns: row.completedRuns,
      failedRuns: row.failedRuns,
      successRate: row.successRate,
      medianDurationMs: row.medianDurationMs,
      p95DurationMs: row.p95DurationMs,
    }
  }
  return {
    workflow: input.workflow,
    current: window(
      "current",
      input.currentStartedAfter,
      input.currentStartedBefore,
    ),
    previous: window(
      "previous",
      input.previousStartedAfter,
      input.previousStartedBefore,
    ),
  } satisfies PeriodReadResponse["report"]
})
