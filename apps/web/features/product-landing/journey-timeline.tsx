"use client"

import { useState } from "react"
import { Button, cn } from "@flowmark/ui"
import { MotionScene } from "./motion"
import { journey } from "./process-data"

export function JourneyTimeline() {
  const [selected, setSelected] = useState("booking")
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute top-6 bottom-20 left-[21px] w-px bg-border sm:left-[25px]"
      >
        <div className="h-full w-px origin-top bg-linear-to-b from-primary via-primary/70 to-highlight/50 motion-safe:supports-[animation-timeline:view()]:animate-scroll-trace motion-safe:supports-[animation-timeline:view()]:[animation-timeline:view()] motion-safe:supports-[animation-timeline:view()]:[animation-range:entry_10%_exit_80%]" />
      </div>
      {journey.map((step, index) => (
        <MotionScene key={step.id} className="pb-12 last:pb-0 sm:pb-16">
          <div className="relative flex gap-5 sm:gap-8">
            <Button
              variant="outline"
              aria-label={`Explore ${step.title.toLowerCase()} evidence`}
              aria-expanded={selected === step.id}
              aria-controls={`journey-${step.id}`}
              onClick={() => setSelected(selected === step.id ? "" : step.id)}
              className={cn(
                "relative z-10 size-11 shrink-0 rounded-full bg-background font-mono text-xs sm:size-13",
                step.attention
                  ? "border-highlight/50 text-highlight"
                  : "border-primary/35 text-primary",
                selected === step.id && "shadow-[0_0_30px_-9px_#b9f59750]",
              )}
            >
              {step.attention ? "?" : `0${index + 1}`}
              {selected === step.id && (
                <span
                  aria-hidden="true"
                  className="absolute -inset-2 rounded-full border border-primary/20 opacity-0 group-data-[playing=true]/scene:animate-node-signal"
                />
              )}
            </Button>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                <span>{step.code}</span>
                <span>{step.time}</span>
              </div>
              <h3
                className={cn(
                  "mt-3 text-3xl font-medium tracking-[-.04em] sm:text-4xl",
                  step.attention && "text-highlight",
                )}
              >
                {step.title}
                <span className="text-muted-foreground/40">.</span>
              </h3>
              <p className="mt-3 text-xs text-muted-foreground">
                {step.status}
              </p>
              <div
                id={`journey-${step.id}`}
                hidden={selected !== step.id}
                className="mt-5 border-t border-border/60 pt-5 motion-safe:animate-arrive"
              >
                <p className="max-w-md text-xs leading-6 text-muted-foreground">
                  {step.description}
                </p>
                <p className="mt-3 break-words font-mono text-[10px] leading-6 text-primary">
                  {step.payload}
                </p>
                {step.id === "booking" && (
                  <div className="relative mt-6 overflow-hidden border-l border-border py-2 pl-4">
                    <p className="mb-4 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      Inside this execution / 1.8 s
                    </p>
                    <div className="space-y-4 text-[10px]">
                      <div>
                        <p className="text-muted-foreground">
                          Validate reference{" "}
                          <span className="float-right">24 ms</span>
                        </p>
                        <div className="mt-2 h-1.5 w-[8%] origin-left rounded-full bg-highlight/70 motion-safe:animate-timeline-grow" />
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          Patient lookup{" "}
                          <span className="float-right">86 ms</span>
                        </p>
                        <div className="mt-2 ml-[8%] h-1.5 w-[16%] origin-left rounded-full bg-highlight/70 motion-safe:animate-timeline-grow [animation-delay:.15s]" />
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          Orbit accepts booking{" "}
                          <span className="float-right">1.6 s</span>
                        </p>
                        <div className="mt-2 ml-[12%] h-1.5 w-[88%] origin-left rounded-full bg-primary/80 motion-safe:animate-timeline-grow [animation-delay:.3s]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </MotionScene>
      ))}
      <p className="mt-8 pl-16 text-[9px] leading-5 text-muted-foreground sm:pl-21">
        Synthetic journey · observed 24 Oct 2026, 11:00 UTC.
        <br />A missing signal leaves the actual provider state unknown.
      </p>
    </div>
  )
}
