"use client"

import { useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Button, NativeSelect, NativeSelectOption } from "@flowmark/ui"
import { periodDays, periodWindow, type PeriodDays } from "./dashboard-data"
import { useProject } from "./project-context"
import { useTRPC } from "../lib/trpc"

export function usePeriodSelection() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const days = periodDays(params.get("days"))
  const workflow = params.get("workflow")?.trim() || undefined
  const trpc = useTRPC()
  const { current } = useProject()
  const selection = useMemo(() => {
    const period = periodWindow(days)
    return {
      period,
      input: {
        ...(workflow ? { workflow } : {}),
        currentStartedAfter: period.currentStartedAfter,
        currentStartedBefore: period.currentStartedBefore,
        previousStartedAfter: period.previousStartedAfter,
        previousStartedBefore: period.previousStartedBefore,
      },
    }
  }, [days, workflow])
  const report = useQuery({
    ...trpc.project.periodReport.queryOptions(selection.input),
    enabled: Boolean(current),
  })
  const replace = (nextDays: PeriodDays, nextWorkflow?: string) => {
    const query = new URLSearchParams()
    if (nextDays === 30) {
      query.set("days", "30")
    }
    if (nextWorkflow) {
      query.set("workflow", nextWorkflow)
    }
    const text = query.toString()
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false })
  }
  const workflowNames = [
    ...new Set([
      ...(report.data?.workflowNames ?? []),
      ...(workflow ? [workflow] : []),
    ]),
  ]
  return {
    days,
    workflow,
    period: selection.period,
    report,
    replace,
    workflowNames,
  }
}

export function PeriodControls({
  days,
  workflow,
  workflowNames,
  onChange,
}: {
  days: PeriodDays
  workflow?: string
  workflowNames: readonly string[]
  onChange: (days: PeriodDays, workflow?: string) => void
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="grid gap-2">
        <span id="period-days" className="text-xs text-muted-foreground">
          Started during
        </span>
        <div
          role="group"
          aria-labelledby="period-days"
          className="flex w-fit rounded-lg border border-border bg-card p-0.5"
        >
          {([7, 30] as const).map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={days === value ? "secondary" : "ghost"}
              className="shadow-none"
              aria-pressed={days === value}
              onClick={() => onChange(value, workflow)}
            >
              {value} days
            </Button>
          ))}
        </div>
      </div>
      <div className="grid min-w-0 flex-1 gap-2 sm:max-w-xs">
        <label
          htmlFor="period-workflow"
          className="text-xs text-muted-foreground"
        >
          Workflow
        </label>
        <NativeSelect
          id="period-workflow"
          value={workflow ?? ""}
          onChange={(event) => onChange(days, event.target.value || undefined)}
        >
          <NativeSelectOption value="">All workflows</NativeSelectOption>
          {workflowNames.map((name) => (
            <NativeSelectOption key={name} value={name}>
              {name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    </div>
  )
}
