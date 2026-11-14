"use client"

import { useState } from "react"
import { Array, pipe } from "effect"
import { Button, cn } from "@flowmark/ui"
import { comparison } from "./process-data"
import { MotionScene } from "./motion"

const dots = pipe(
  Array.range(0, 99),
  Array.map((index) => ({
    index,
    x: 20 + (index % 20) * 27,
    y: 22 + Math.floor(index / 20) * 32,
  })),
)
const delays = [
  "delay-0",
  "delay-75",
  "delay-150",
  "delay-200",
  "delay-300",
] as const

function HealthOrbit({ current }: { current: boolean }) {
  return (
    <div className="relative mx-auto aspect-square w-56 sm:w-64">
      <svg
        viewBox="0 0 240 240"
        className="size-full -rotate-90"
        role="img"
        aria-label={`Process health: ${current ? 76 : 92}% confirmed, 99.3% execution completion, 100% required-field coverage.`}
      >
        {[96, 74, 52].map((radius) => (
          <circle
            key={radius}
            cx="120"
            cy="120"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-border/50"
          />
        ))}
        <circle
          cx="120"
          cy="120"
          r="96"
          pathLength="100"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${current ? 76 : 92} 100`}
          className="text-primary transition-[stroke-dasharray] duration-1000 motion-reduce:transition-none"
        />
        <circle
          cx="120"
          cy="120"
          r="74"
          pathLength="100"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="99.3 100"
          className="text-success"
        />
        <circle
          cx="120"
          cy="120"
          r="52"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-highlight"
        />
        <circle
          cx="120"
          cy="120"
          r="108"
          pathLength="1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray=".03 .97"
          className="text-primary opacity-0 group-data-[playing=true]/scene:animate-orbit-trace"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          Process
        </span>
        <span className="mt-1 text-sm">health</span>
      </div>
    </div>
  )
}

export function OutcomeField() {
  const [current, setCurrent] = useState(true)
  const rate = current ? 76 : 92
  const count = current
    ? comparison.currentConfirmed
    : comparison.baselineConfirmed
  return (
    <MotionScene className="mt-12 sm:mt-16">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 pb-5">
        <div
          className="flex items-center gap-2"
          role="group"
          aria-label="Compare booking cohorts"
        >
          <Button
            variant="ghost"
            aria-pressed={!current}
            onClick={() => setCurrent(false)}
            className={cn(
              "h-11 px-3 text-[11px] text-muted-foreground",
              !current && "bg-primary/10 text-primary",
            )}
          >
            Before release
          </Button>
          <span aria-hidden="true" className="text-muted-foreground/50">
            →
          </span>
          <Button
            variant="ghost"
            aria-pressed={current}
            onClick={() => setCurrent(true)}
            className={cn(
              "h-11 px-3 text-[11px] text-muted-foreground",
              current && "bg-primary/10 text-primary",
            )}
          >
            After release
          </Button>
        </div>
        <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          Same definition. Same-sized cohorts.
        </p>
      </div>
      <div className="grid gap-10 py-10 lg:grid-cols-[1.4fr_.8fr] lg:gap-20 lg:py-14">
        <div>
          <div className="flex flex-wrap items-end gap-5 sm:gap-8">
            <p className="text-[clamp(5rem,11vw,8rem)] leading-none font-medium tracking-[-.08em] text-primary">
              <span
                key={rate}
                className="inline-block motion-safe:animate-arrive"
              >
                {rate}
              </span>
              <span className="ml-1 text-[.4em] text-primary/60">%</span>
            </p>
            <div className="pb-2">
              <h3 className="max-w-48 text-lg leading-snug tracking-tight">
                Confirmed within
                <br />
                20 minutes.
              </h3>
              <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                {count} / 700 eligible bookings
              </p>
            </div>
          </div>
          <svg
            viewBox="0 0 555 176"
            className="mt-9 w-full overflow-visible"
            role="img"
            aria-label={`${rate} percent confirmed. ${100 - rate} percent have no confirmation recorded within 20 minutes. Each dot represents seven bookings.`}
          >
            {dots.map(({ index, x, y }) => (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="5.5"
                className={cn(
                  "transition-[fill,opacity] duration-700 motion-reduce:transition-none",
                  delays[Math.floor(index / 20)],
                  index < rate ? "fill-primary/90" : "fill-highlight/65",
                )}
              />
            ))}
          </svg>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 font-mono text-[9px] text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-primary" />
              Confirmed
            </span>
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-highlight" />
              No confirmation in window
            </span>
            <span>1 dot = 7 bookings</span>
          </div>
        </div>
        <div className="grid items-center gap-4 min-[420px]:grid-cols-[1fr_1fr] lg:grid-cols-1">
          <HealthOrbit current={current} />
          <div className="mx-auto w-full max-w-64 space-y-4 text-[11px]">
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">Business outcome</span>
              <span className="text-primary">{rate}% confirmed</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                Execution completion
              </span>
              <span className="text-success">99.3%</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                Required-field coverage
              </span>
              <span className="text-highlight">100%</span>
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-5 border-y border-border/70 py-7 sm:grid-cols-[.55fr_1fr] sm:gap-12">
        <p className="flex items-start gap-3 font-mono text-[10px] uppercase tracking-[.14em] text-highlight">
          <span aria-hidden="true" className="relative mt-1 flex size-2">
            <span className="absolute inset-0 rounded-full bg-highlight/50 group-data-[playing=true]/scene:animate-evidence-pulse" />
            <span className="relative size-2 rounded-full bg-highlight" />
          </span>{" "}
          {current
            ? "A change worth investigating"
            : "Your historical baseline"}
        </p>
        <div aria-live="polite">
          <h3 className="text-xl leading-snug font-medium tracking-tight sm:text-2xl">
            {current
              ? "Executions stayed stable. Confirmations fell 16 points."
              : "92% confirmed. A baseline with its evidence attached."}
          </h3>
          <p className="mt-3 max-w-xl text-xs leading-6 text-muted-foreground">
            {current
              ? "Flowmark draws attention to the changed outcome, then connects it to the release, the affected population and the underlying journeys. Association is a starting point for investigation."
              : "644 confirmations across 700 eligible bookings. The comparison preserves the process definition, observation window and contributing evidence."}
          </p>
        </div>
      </div>
      <details className="mt-4 text-[10px] text-muted-foreground">
        <summary className="w-fit cursor-pointer py-2">
          Inspect the comparison evidence
        </summary>
        <div
          tabIndex={0}
          role="region"
          aria-label="Comparison evidence table"
          className="mt-3 overflow-x-auto"
        >
          <table className="w-full min-w-96 border-collapse text-left">
            <caption className="mb-4 text-left leading-5">
              Synthetic Meridian Health cohorts · 10–17 Oct and 17–24 Oct 2026,
              bounded at 10:30 UTC. Observed 24 Oct at 11:00 UTC; every
              20-minute window has matured. Definition: {comparison.definition}.
            </caption>
            <thead className="border-b border-border">
              <tr>
                <th className="py-2 font-medium">Evidence</th>
                <th className="font-medium">Before</th>
                <th className="font-medium">After</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <tr>
                <td className="py-3">Confirmed within 20 minutes</td>
                <td>644 / 700</td>
                <td>532 / 700</td>
              </tr>
              <tr>
                <td className="py-3">Completed executions</td>
                <td>695 / 700</td>
                <td>695 / 700</td>
              </tr>
              <tr>
                <td className="py-3">Required fields reported</td>
                <td>700 / 700</td>
                <td>700 / 700</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </MotionScene>
  )
}
