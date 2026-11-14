"use client"

import { useState } from "react"
import { Button, cn } from "@flowmark/ui"
import { MotionScene, SignalPath } from "./motion"
import { ProcessIcon, type ProcessIconName } from "./process-icon"

const stages = [
  {
    label: "Detect drift",
    icon: "branch",
    position: "top-[23%] left-[18%]",
    title: "Find a missing confirmation signal.",
    detail:
      "A refactor introduces a new event handler. The confirmation is no longer instrumented. Flowmark connects the code change to the expectation it affects.",
    status: "A gap in the evidence",
    color: "text-highlight",
  },
  {
    label: "Review the patch",
    icon: "agent",
    position: "top-[23%] left-[82%]",
    title: "Review the instrumentation update.",
    detail:
      "Your coding agent proposes restoring the existing confirmation reference. Your team reviews the change, with the process context beside it.",
    status: "Agent-prepared · human-reviewed",
    color: "text-highlight",
  },
  {
    label: "Verify the evidence",
    icon: "evidence",
    position: "top-[80%] left-[50%]",
    title: "Verify the updated evidence.",
    detail:
      "Exercise the changed path and verify that its signal is emitted, persisted and readable. Carry the same process meaning into the next release.",
    status: "Observed evidence, end to end",
    color: "text-primary",
  },
] as const satisfies readonly {
  label: string
  icon: ProcessIconName
  position: string
  title: string
  detail: string
  status: string
  color: string
}[]

export function EvolutionExperience() {
  const [stage, setStage] = useState<0 | 1 | 2>(0)
  const current = stages[stage]
  return (
    <MotionScene className="mt-12 grid items-center gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
      <div className="relative h-[390px] sm:h-[430px]">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--highlight)/0.09),transparent_65%)]"
        />
        <svg
          viewBox="0 0 600 430"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
          aria-hidden="true"
        >
          <SignalPath
            d="M108 99 C220 15 380 15 492 99"
            className="text-highlight"
          />
          <SignalPath
            d="M492 99 C590 260 420 330 300 344"
            active={stage > 0}
            className="text-highlight"
            delay="[animation-delay:2s]"
          />
          <SignalPath
            d="M300 344 C140 330 10 260 108 99"
            active={stage === 2}
            delay="[animation-delay:4s]"
          />
          <path
            d="M300 344 C140 330 10 260 108 99"
            fill="none"
            stroke="currentColor"
            strokeDasharray="4 8"
            className={stage === 2 ? "text-transparent" : "text-highlight/20"}
          />
          <circle
            cx="300"
            cy="208"
            r="80"
            fill="none"
            stroke="currentColor"
            className="text-highlight/10"
          />
          <circle
            cx="300"
            cy="208"
            r="96"
            fill="none"
            stroke="currentColor"
            strokeDasharray="2 10"
            className="text-highlight/10"
          />
        </svg>
        {stages.map((item, index) => (
          <div
            key={item.label}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2",
              item.position,
            )}
          >
            <Button
              variant="outline"
              onClick={() => setStage(index as 0 | 1 | 2)}
              aria-pressed={stage === index}
              aria-label={item.label}
              className={cn(
                "size-16 rounded-2xl border-highlight/30 bg-background text-highlight transition-[border-color,box-shadow,transform] duration-500 motion-safe:hover:-translate-y-1 [&_svg]:size-6 sm:size-19",
                stage === index &&
                  "border-highlight/80 shadow-[0_0_50px_-12px_#b7a3ff50]",
                stage === 2 && index === 2 && "border-primary/60 text-primary",
              )}
            >
              <ProcessIcon name={item.icon} />
            </Button>
            <p className="absolute top-full left-1/2 mt-4 w-34 -translate-x-1/2 text-center text-[11px] text-muted-foreground">
              {item.label}
            </p>
          </div>
        ))}
        <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <p className="font-mono text-[8px] uppercase tracking-[.14em] text-muted-foreground sm:text-[9px]">
            Preserve the meaning
          </p>
          <p className="mt-3 font-mono text-[10px] text-foreground sm:text-xs">
            booking.confirmed
          </p>
          <span
            className={cn(
              "mt-3 inline-block size-1.5 rounded-full",
              stage === 2 ? "bg-primary" : "bg-highlight",
            )}
          />
        </div>
      </div>
      <div className="min-h-[350px]" aria-live="polite">
        <p
          className={cn(
            "font-mono text-[9px] uppercase tracking-widest",
            current.color,
          )}
        >
          0{stage + 1} / {current.status}
        </p>
        <h3 className="mt-5 text-4xl font-medium tracking-[-.045em]">
          {current.title}
        </h3>
        <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">
          {current.detail}
        </p>
        <div className="mt-7 border-y border-border py-5">
          {stage === 0 && (
            <div className="font-mono text-[10px] leading-7 sm:text-xs">
              <p className="text-muted-foreground line-through decoration-highlight/50">
                webhooks/confirmation.ts
              </p>
              <p className="text-foreground">↳ events/booking-confirmed.ts</p>
              <p className="mt-3 flex items-center gap-2 text-highlight">
                <span className="size-1.5 rounded-full bg-highlight" />
                Confirmation signal not found
              </p>
            </div>
          )}
          {stage === 1 && (
            <pre
              tabIndex={0}
              aria-label="Illustrative instrumentation patch"
              className="overflow-x-auto font-mono text-[10px] leading-7 sm:text-xs"
            >
              <code>
                <span className="text-muted-foreground">
                  {"  await persistConfirmation(event)\n"}
                </span>
                <span className="text-primary">
                  {
                    "+ flowmark.resolveExpectation(\n+   event.confirmationReference\n+ )"
                  }
                </span>
              </code>
            </pre>
          )}
          {stage === 2 && (
            <div className="space-y-3 text-[11px]">
              {[
                "Confirmation emitted",
                "Expectation resolved in storage",
                "Same evidence returned by the API",
              ].map((check) => (
                <p key={check} className="flex items-center gap-3">
                  <span className="text-primary">✓</span>
                  {check}
                </p>
              ))}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          onClick={() => setStage(stage === 2 ? 0 : ((stage + 1) as 1 | 2))}
          className="mt-4 h-11 px-0 text-xs text-primary hover:bg-transparent"
        >
          {stage === 2 ? "Explore the change again" : stages[stage + 1].label}
          <span aria-hidden="true">→</span>
        </Button>
        <p className="mt-3 text-[9px] leading-5 text-muted-foreground">
          Illustrative change review · no repository changes or tests are
          executed.
        </p>
      </div>
    </MotionScene>
  )
}
