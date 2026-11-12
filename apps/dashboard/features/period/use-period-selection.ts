"use client"

import { useQuery } from "@tanstack/react-query"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useMemo } from "react"
import { useTRPC } from "../platform/api-trpc"
import { useProject } from "../projects/project-context"
import { periodDays, periodWindow, type PeriodDays } from "./period"

export function usePeriodSelection(enabled = true) {
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
    enabled: Boolean(current) && enabled,
  })
  const replace = (nextDays: PeriodDays, nextWorkflow?: string) => {
    const query = new URLSearchParams(params.toString())
    if (nextDays === 30) {
      query.set("days", "30")
    } else {
      query.delete("days")
    }
    if (nextWorkflow) {
      query.set("workflow", nextWorkflow)
    } else {
      query.delete("workflow")
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
