import { Array as EffectArray } from "effect"
import type { DayInsight, Run } from "../platform/api-types"

export function percentile(values: readonly number[], p: number) {
  if (values.length === 0) {
    return null
  }
  const sorted = [...values].sort((left, right) => left - right)
  const index = (sorted.length - 1) * p
  const low = Math.floor(index)
  const high = Math.ceil(index)
  const lower = sorted[low]
  if (lower === undefined) {
    return null
  }
  const upper = sorted[high]
  if (upper === undefined || low === high) {
    return lower
  }
  return lower + (upper - lower) * (index - low)
}

export function summarizeDays(days: readonly DayInsight[]) {
  const count = days.reduce((sum, day) => sum + day.count, 0)
  const completed = days.reduce((sum, day) => sum + day.completed, 0)
  const failed = days.reduce((sum, day) => sum + day.failed, 0)
  const finished = completed + failed
  return {
    count,
    failed,
    successRate:
      finished === 0 ? null : Math.round((1000 * completed) / finished) / 10,
  }
}

export function weekOverWeek(daily: readonly DayInsight[]) {
  return {
    current: summarizeDays(daily.slice(-7)),
    previous: summarizeDays(daily.slice(-14, -7)),
  }
}

export function durationInRange(
  runs: readonly Run[],
  startDate: string,
  endDate: string,
) {
  const values = runs.flatMap((run) => {
    const day = run.startedAt.slice(0, 10)
    return day >= startDate && day <= endDate && run.durationMs != null
      ? [run.durationMs]
      : []
  })
  return {
    median: percentile(values, 0.5),
    p95: percentile(values, 0.95),
  }
}

/** Client-side daily counts from a run slice (e.g. latest 100 for one workflow). */
export function dailyFromRuns(runs: readonly Run[], days = 30): DayInsight[] {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const byDate = new Map<
    string,
    {
      completed: number
      failed: number
      running: number
      durations: number[]
    }
  >()
  EffectArray.forEach(
    EffectArray.makeBy(days, (index) => days - 1 - index),
    (offset) => {
      const date = new Date(today)
      date.setUTCDate(today.getUTCDate() - offset)
      byDate.set(date.toISOString().slice(0, 10), {
        completed: 0,
        failed: 0,
        running: 0,
        durations: [],
      })
    },
  )
  EffectArray.forEach(EffectArray.fromIterable(runs), (run) => {
    const day = run.startedAt.slice(0, 10)
    const bucket = byDate.get(day)
    if (!bucket) {
      return
    }
    if (run.status === "Completed") {
      bucket.completed += 1
    } else if (run.status === "Failed") {
      bucket.failed += 1
    } else {
      bucket.running += 1
    }
    if (run.durationMs != null) {
      bucket.durations.push(run.durationMs)
    }
  })
  return [...byDate.entries()].map(([date, bucket]) => {
    const finished = bucket.completed + bucket.failed
    return {
      date,
      count: finished + bucket.running,
      completed: bucket.completed,
      failed: bucket.failed,
      successRate:
        finished === 0
          ? null
          : Math.round((1000 * bucket.completed) / finished) / 10,
      medianDurationMs: percentile(bucket.durations, 0.5),
      p95DurationMs: percentile(bucket.durations, 0.95),
    }
  })
}

export function percentChange(current: number | null, previous: number | null) {
  if (current == null || previous == null || previous === 0) {
    return null
  }
  return Math.round((1000 * (current - previous)) / previous) / 10
}
