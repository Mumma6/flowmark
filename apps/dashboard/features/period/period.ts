function startOfUtcDay(date: Date) {
  const day = new Date(date)
  day.setUTCHours(0, 0, 0, 0)
  return day
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export type PeriodDays = 7 | 30

export function periodDays(value: string | null): PeriodDays {
  return value === "30" ? 30 : 7
}

/** Inclusive UTC start days, compared with the immediately previous window. */
export function periodWindow(days: PeriodDays, now = new Date()) {
  const today = startOfUtcDay(now)
  const currentStartedAfter = addUtcDays(today, -(days - 1))
  const currentStartedBefore = addUtcDays(today, 1)
  const previousStartedAfter = addUtcDays(currentStartedAfter, -days)
  return {
    days,
    currentStartedAfter: currentStartedAfter.toISOString(),
    currentStartedBefore: currentStartedBefore.toISOString(),
    previousStartedAfter: previousStartedAfter.toISOString(),
    previousStartedBefore: currentStartedAfter.toISOString(),
    after: currentStartedAfter.toISOString().slice(0, 10),
    before: currentStartedBefore.toISOString().slice(0, 10),
  }
}

export function defaultIntelligenceQuery(workflow?: string) {
  const period = periodWindow(7)
  return {
    workflow: workflow || undefined,
    currentStartedAfter: period.currentStartedAfter,
    currentStartedBefore: period.currentStartedBefore,
    previousStartedAfter: period.previousStartedAfter,
    previousStartedBefore: period.previousStartedBefore,
  }
}

export function windowLabel(window: {
  startedAfter: string
  startedBefore: string
}) {
  const end = new Date(Date.parse(window.startedBefore) - 1)
    .toISOString()
    .slice(0, 10)
  return `${window.startedAfter.slice(0, 10)} – ${end}`
}
