"use client"

import { useState, type ReactNode } from "react"
import { Button, FlowmarkMark, cn } from "@flowmark/ui"
import { MotionScene, SignalPath } from "./motion"
import { ProcessIcon } from "./process-icon"

const entrances = {
  assisted: {
    title: "Discover processes across code paths.",
    label: "Agent-assisted discovery",
    inputs: [
      "routes / sync-customers.ts",
      "integrations / customer-api.ts",
      "jobs / sync-complete.ts",
    ],
    signals: ["Entry point", "External boundary", "Expected outcome"],
    status: "Candidate discovered",
    detail:
      "A request starts a customer sync. A background job writes the records. Your agent connects the code paths; your team defines a successful sync.",
  },
  automatic: {
    title: "Capture useful runtime context automatically.",
    label: "Automatic observation",
    inputs: [
      "HTTP / POST appointments",
      "PostgreSQL / customer lookup",
      "External API / submit booking",
    ],
    signals: ["Request · 1.8 s", "Query · 86 ms", "Response · 202"],
    status: "Technical context connected",
    detail:
      "Selected runtime adapters surface requests, database calls and integrations. Safe defaults exclude bodies, credentials and query parameters.",
  },
  precision: {
    title: "Small markers. Precise business meaning.",
    label: "Precision SDK",
    inputs: [
      "workflow / booking.submit",
      "result / accepted: true",
      "expect / booking.confirmed",
    ],
    signals: ["Business context", "Reported result", "20-minute expectation"],
    status: "Meaning made explicit",
    detail:
      "Name the work, report its outcome, and declare what should happen next. Uses a configured Flowmark client. Your application owns execution and forwards the expectation reference to its callback.",
  },
} as const
type Entrance = keyof typeof entrances

export function DiscoveryField({ code }: { code: ReactNode }) {
  const [mode, setMode] = useState<Entrance>("assisted")
  const [review, setReview] = useState(false)
  const entrance = entrances[mode]
  return (
    <MotionScene className="mt-12">
      <div
        role="group"
        aria-label="Ways to discover and observe"
        className="flex flex-wrap gap-2 border-b border-border pb-3 sm:gap-8"
      >
        {(
          [
            { id: "assisted", label: "Agent-assisted" },
            { id: "automatic", label: "Automatic" },
            { id: "precision", label: "Precision SDK" },
          ] as const
        ).map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            aria-pressed={mode === item.id}
            onClick={() => {
              setMode(item.id)
              setReview(false)
            }}
            className={cn(
              "h-11 flex-1 rounded-none border-b border-transparent px-1 text-[11px] text-muted-foreground hover:bg-transparent sm:flex-none",
              mode === item.id && "border-primary text-primary",
            )}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <div className="relative mt-5 grid gap-10 py-8 sm:mt-10 lg:grid-cols-[1fr_.8fr] lg:gap-20 lg:py-12">
        <div className="relative min-h-[360px] sm:min-h-[390px]">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_55%,var(--hero-glow),transparent_60%)]"
          />
          <svg
            viewBox="0 0 600 380"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full"
            aria-hidden="true"
          >
            <SignalPath d="M210 65 C330 65 290 185 440 185" />
            <SignalPath d="M230 185 H440" delay="[animation-delay:1.6s]" />
            <SignalPath
              d="M210 305 C330 305 290 185 440 185"
              delay="[animation-delay:3.2s]"
              className="text-highlight"
            />
            <circle
              cx="440"
              cy="185"
              r="78"
              fill="none"
              stroke="currentColor"
              className="text-primary/10"
            />
            <circle
              cx="440"
              cy="185"
              r="104"
              fill="none"
              stroke="currentColor"
              strokeDasharray="2 12"
              className="text-primary/15"
            />
            <circle
              cx="440"
              cy="185"
              r="78"
              pathLength="1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray=".15 .85"
              className="text-primary opacity-0 group-data-[playing=true]/scene:animate-orbit-trace"
            />
          </svg>
          <div className="absolute inset-y-0 left-0 flex w-[55%] flex-col justify-between py-5">
            {entrance.inputs.map((input, i) => (
              <div
                key={i}
                className={cn(
                  "relative w-full max-w-65 border-l border-border bg-linear-to-r from-card to-transparent py-4 pl-3 sm:pl-5",
                  i === 1 && "translate-x-3",
                )}
              >
                <span className="mb-3 block font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                  0{i + 1} / {entrance.signals[i]}
                </span>
                <p className="break-words font-mono text-[10px] leading-5 text-foreground/90 sm:text-[11px]">
                  {input}
                </p>
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 w-px origin-top bg-primary/70 group-data-[playing=true]/scene:animate-scan-line"
                />
              </div>
            ))}
          </div>
          <div className="absolute top-[49%] left-[73.33%] -translate-x-1/2 -translate-y-1/2">
            <div className="flex size-20 rotate-45 items-center justify-center rounded-[1.6rem] border border-primary/35 bg-background shadow-[0_0_70px_-10px_#b9f59725] sm:size-24">
              <FlowmarkMark className="size-9 -rotate-45 text-primary" />
            </div>
            <p className="absolute top-full left-1/2 mt-8 w-34 -translate-x-1/2 text-center font-mono text-[9px] leading-5 text-primary">
              {entrance.status}
            </p>
          </div>
        </div>
        <div className="self-center">
          <p className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-highlight">
            <ProcessIcon name="agent" className="size-4" />
            {entrance.label}
          </p>
          <h3 className="mt-5 max-w-sm text-3xl leading-[1.15] font-medium tracking-[-.04em] sm:text-4xl">
            {entrance.title}
          </h3>
          <p className="mt-5 max-w-sm text-sm leading-7 text-muted-foreground">
            {entrance.detail}
          </p>
          {mode === "assisted" && (
            <>
              <Button
                variant="ghost"
                onClick={() => setReview(!review)}
                aria-expanded={review}
                aria-controls="discovery-review"
                className="mt-5 h-11 px-0 text-xs text-primary hover:bg-transparent"
              >
                {review ? "Close the discovery" : "Look inside the discovery"}
                <span aria-hidden="true">{review ? "−" : "↗"}</span>
              </Button>
              <div
                id="discovery-review"
                hidden={!review}
                className="mt-3 border-l border-highlight/40 pl-4 text-xs leading-6 text-muted-foreground"
              >
                <p className="text-highlight">One question needs your team.</p>
                <p className="mt-2">
                  Does “synchronized” mean the destination accepted every
                  record? How should skipped records affect the outcome? Review
                  the inferred relationship before publishing its meaning.
                </p>
              </div>
            </>
          )}
          {mode === "precision" && (
            <details className="mt-5">
              <summary className="cursor-pointer py-3 text-xs text-primary">
                See the instrumentation example
              </summary>
              <div className="mt-3 min-w-0">{code}</div>
            </details>
          )}
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-3 border-t border-border/60 py-4 font-mono text-[9px] text-muted-foreground">
        <span>
          THREE INDEPENDENT STARTING POINTS. CONNECT THEM WHEN USEFUL.
        </span>
        <span>Illustrative application</span>
      </div>
    </MotionScene>
  )
}
