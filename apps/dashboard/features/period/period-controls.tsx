"use client"

import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@flowmark/ui"
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
        <span id="period-days" className="text-sm text-muted-foreground">
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
              className="min-h-10 text-xs shadow-none sm:min-h-8"
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
          className="text-sm text-muted-foreground"
        >
          Workflow
        </label>
        <Select
          items={{
            "": "All workflows",
            ...Object.fromEntries(workflowNames.map((name) => [name, name])),
          }}
          value={workflow ?? ""}
          onValueChange={(next) => onChange(days, next || undefined)}
        >
          <SelectTrigger id="period-workflow">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All workflows</SelectItem>
            {workflowNames.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
