"use client"

import { Button, cn } from "@flowmark/ui"
import { useState } from "react"
import { journey } from "./process-data"

export function ProcessJourney({
  onInspect,
}: {
  onInspect: (button: HTMLButtonElement) => void
}) {
  const [selected, setSelected] = useState<(typeof journey)[number]>(journey[3])
  return (
    <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[1.5fr_1fr] lg:gap-8">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Observed journey / SYN-REF-2049
        </p>
        <h3 className="mt-4 text-2xl font-medium tracking-tight">
          Follow the work. Find the gap.
        </h3>
        <div className="relative mt-8 grid grid-cols-2 gap-3 sm:mt-12 sm:grid-cols-4 sm:gap-4">
          <div
            aria-hidden="true"
            className="absolute top-7 right-8 left-8 hidden h-px bg-linear-to-r from-success/60 via-primary/60 to-warning/40 sm:block"
          />
          {journey.map((step, index) => (
            <button
              key={step.id}
              type="button"
              aria-pressed={selected.id === step.id}
              onClick={() => setSelected(step)}
              className={cn(
                "group relative flex min-w-0 flex-col items-center rounded-lg border border-transparent px-1 py-2 text-center transition-colors hover:bg-secondary/60",
                selected.id === step.id && "border-border bg-secondary/40",
              )}
            >
              <span
                className={cn(
                  "relative grid size-10 place-items-center rounded-xl border bg-card font-mono text-xs transition-colors",
                  step.attention
                    ? "border-dashed border-warning/60 text-warning"
                    : "border-success/40 text-success",
                  selected.id === step.id && "ring-4 ring-primary/5",
                )}
                aria-hidden="true"
              >
                {step.attention ? "…" : "✓"}
              </span>
              <span className="mt-4 text-xs font-medium">{step.title}</span>
              <span
                className={cn(
                  "mt-1 text-[10px]",
                  step.attention ? "text-warning" : "text-muted-foreground",
                )}
              >
                {step.status}
              </span>
              <span className="mt-3 font-mono text-[9px] text-muted-foreground">
                {String(index + 1).padStart(2, "0")} / {step.time}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-7 text-[11px] leading-6 text-muted-foreground">
          Independent executions. One connected business reference.
          <br />
          Select a step to explore its evidence.
        </p>
      </div>
      <div
        className="rounded-xl border border-border bg-background/60 p-5 sm:p-6"
        aria-live="polite"
        aria-atomic="true"
      >
        <p className="font-mono text-[10px] text-highlight">{selected.code}</p>
        <h4
          className={cn(
            "mt-5 text-xl font-medium tracking-tight",
            selected.attention && "text-warning",
          )}
        >
          {selected.status}
        </h4>
        <p className="mt-3 min-h-20 text-xs leading-6 text-muted-foreground">
          {selected.description}
        </p>
        <code className="mt-4 block break-words border-t border-border pt-4 text-[10px] leading-6 text-foreground/80">
          {selected.payload}
        </code>
        <Button
          variant="outline"
          onClick={(event) => onInspect(event.currentTarget)}
          className="mt-5 h-10 text-xs"
        >
          Inspect booking run <span aria-hidden="true">↗</span>
        </Button>
      </div>
    </div>
  )
}
