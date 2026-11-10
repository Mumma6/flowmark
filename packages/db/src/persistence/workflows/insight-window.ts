import type { InsightWindow } from "./types.js"

/** Empty population only, never recovery from a failed query. */
export const emptyInsightWindow = (
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
