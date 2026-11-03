"use client"

import { Button, NativeSelect, NativeSelectOption } from "@flowmark/ui"
import { type PeriodDays } from "./period"

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
