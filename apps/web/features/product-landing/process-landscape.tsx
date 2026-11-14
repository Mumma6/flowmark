"use client"

import { useState } from "react"
import { Button, FlowmarkMark, cn } from "@flowmark/ui"
import { MotionControl, MotionScene, SignalPath } from "./motion"
import { ProcessIcon, type ProcessIconName } from "./process-icon"

const nodes = [
  {
    id: "request",
    name: "A request arrives",
    icon: "request",
    position: "left-[15%] top-[16%] sm:left-[9%] sm:top-[37%]",
    code: "POST /appointments",
    detail:
      "A request begins a process. Its business reference travels with the work.",
    delay: "[animation-delay:0s]",
  },
  {
    id: "booking",
    name: "Booking submitted",
    icon: "booking",
    position: "left-[50%] top-[16%] sm:left-[34%] sm:top-[37%]",
    code: "booking.submit",
    detail:
      "The application reports an accepted booking. Execution completed in 1.8 seconds.",
    delay: "[animation-delay:1.5s]",
  },
  {
    id: "provider",
    name: "Provider accepts request",
    icon: "integration",
    position: "left-[85%] top-[16%] sm:left-[60%] sm:top-[37%]",
    code: "External booking API",
    detail:
      "The provider accepts the request. A separate callback is expected within 20 minutes.",
    delay: "[animation-delay:3s]",
  },
  {
    id: "confirmation",
    name: "Confirmation reported",
    icon: "confirmation",
    position: "left-[78%] top-[49%] sm:left-[86%] sm:top-[37%]",
    code: "booking.confirmed",
    detail:
      "The callback reports a confirmation. Flowmark connects it to the original booking.",
    delay: "[animation-delay:4.5s]",
  },
] as const satisfies readonly {
  id: string
  name: string
  icon: ProcessIconName
  position: string
  code: string
  detail: string
  delay: string
}[]

function LandscapePaths({ missing }: { missing: boolean }) {
  return (
    <>
      <svg
        viewBox="0 0 1000 440"
        preserveAspectRatio="none"
        className="absolute inset-0 hidden size-full sm:block"
        aria-hidden="true"
      >
        <SignalPath d="M90 163 H340" />
        <SignalPath d="M340 163 H600" delay="[animation-delay:1.5s]" />
        <SignalPath
          d="M600 163 H860"
          active={!missing}
          delay="[animation-delay:3s]"
        />
        <path
          d="M600 163 H860"
          fill="none"
          stroke="currentColor"
          strokeDasharray="4 7"
          className={missing ? "text-highlight/40" : "text-transparent"}
        />
        <SignalPath
          d="M90 190 C90 340 400 270 485 350"
          className="text-highlight"
          delay="[animation-delay:1s]"
        />
        <SignalPath
          d="M340 190 C340 285 420 280 485 350"
          className="text-highlight"
          delay="[animation-delay:2s]"
        />
        <SignalPath
          d="M600 190 C600 285 550 280 485 350"
          className="text-highlight"
          delay="[animation-delay:3s]"
        />
        <SignalPath
          d="M860 190 C860 340 570 270 485 350"
          active={!missing}
          className="text-highlight"
          delay="[animation-delay:4s]"
        />
        <path
          d="M30 420 C220 280 800 440 970 250M30 270 C240 460 790 270 970 420"
          fill="none"
          stroke="currentColor"
          strokeWidth=".5"
          className="text-highlight/10"
        />
      </svg>
      <svg
        viewBox="0 0 1000 540"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full sm:hidden"
        aria-hidden="true"
      >
        <SignalPath d="M150 86 H500" />
        <SignalPath d="M500 86 H850" delay="[animation-delay:1.5s]" />
        <SignalPath
          d="M850 110 C850 170 780 190 780 265"
          active={!missing}
          delay="[animation-delay:3s]"
        />
        <SignalPath
          d="M150 110 C150 280 360 270 400 410"
          className="text-highlight"
          delay="[animation-delay:1s]"
        />
        <SignalPath
          d="M500 110 C500 260 400 240 400 410"
          className="text-highlight"
          delay="[animation-delay:2s]"
        />
        <SignalPath
          d="M780 290 C780 400 540 330 400 410"
          active={!missing}
          className="text-highlight"
          delay="[animation-delay:4s]"
        />
      </svg>
    </>
  )
}

export function ProcessLandscape() {
  const [selectedNode, setSelectedNode] = useState<(typeof nodes)[number]>(
    nodes[1],
  )
  const [missing, setMissing] = useState(false)
  const selected = selectedNode.id
  const missingSelected = missing && selected === "confirmation"
  return (
    <MotionScene className="mt-4 sm:mt-0">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border/60 pb-3">
        <p className="font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">
          <span className="mr-3 text-primary">↳</span> One booking. A whole
          connected story.
        </p>
        <MotionControl />
      </div>
      <div className="relative h-[540px] sm:h-[440px]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-[10%] h-[85%] bg-[radial-gradient(ellipse_at_48%_80%,hsl(var(--highlight)/0.10),transparent_50%),radial-gradient(ellipse_at_50%_10%,var(--hero-glow),transparent_65%)]"
        />
        <p className="absolute top-3 left-0 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 sm:top-14">
          Your application executes the process
        </p>
        <LandscapePaths missing={missing} />
        {nodes.map((node) => (
          <div
            key={node.id}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2",
              node.position,
            )}
          >
            <Button
              variant="outline"
              aria-pressed={selected === node.id}
              aria-label={`Inspect ${node.code}`}
              onClick={() => setSelectedNode(node)}
              className={cn(
                "relative mx-auto flex size-13 rounded-2xl border-primary/25 bg-background shadow-[0_0_30px_-15px_#b9f59780] transition-[border-color,box-shadow,transform] duration-500 motion-safe:hover:-translate-y-1 hover:border-primary/70 sm:size-17 [&_svg]:size-6",
                selected === node.id &&
                  "border-primary/80 shadow-[0_0_35px_-12px_#b9f59765]",
                missing && node.id === "confirmation"
                  ? "border-dashed border-highlight/50 text-highlight"
                  : "text-primary",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute -inset-2 rounded-[1.35rem] border border-primary/30 opacity-0 group-data-[playing=true]/scene:animate-node-signal",
                  node.delay,
                  missing && node.id === "confirmation" && "hidden",
                )}
              />
              {missing && node.id === "confirmation" ? (
                <span className="font-mono text-xl">?</span>
              ) : (
                <ProcessIcon name={node.icon} />
              )}
            </Button>
            <p className="absolute top-full left-1/2 mt-4 w-20 -translate-x-1/2 text-center text-[10px] leading-4 text-foreground/85 sm:w-44 sm:text-xs">
              {missing && node.id === "confirmation"
                ? "Confirmation missing"
                : node.name}
            </p>
            <p className="absolute top-full left-1/2 mt-10 hidden w-44 -translate-x-1/2 text-center font-mono text-[9px] text-muted-foreground sm:block">
              {node.code}
            </p>
          </div>
        ))}
        <div className="absolute top-[76%] left-[40%] -translate-x-1/2 -translate-y-1/2 sm:top-[80%] sm:left-[48.5%]">
          <div
            aria-hidden="true"
            className="absolute -inset-7 rounded-full border border-highlight/10 sm:-inset-9"
          />
          <div
            aria-hidden="true"
            className="absolute -inset-4 rounded-full border border-highlight/20"
          />
          <div className="relative flex size-19 items-center justify-center rounded-[1.4rem] border border-highlight/40 bg-background shadow-[0_0_80px_-12px_#b7a3ff35] sm:size-22">
            <FlowmarkMark className="size-9 text-primary" />
          </div>
          <p className="absolute top-full left-1/2 mt-7 w-64 -translate-x-1/2 text-center font-mono text-[10px] uppercase tracking-widest text-highlight">
            Flowmark connects the evidence
          </p>
        </div>
        <p className="absolute top-[49%] left-[8%] max-w-36 text-[10px] leading-5 text-muted-foreground sm:top-[77%] sm:left-[72%] sm:max-w-48 sm:text-xs">
          Separate executions.
          <br />
          <span className="text-foreground">One business process.</span>
        </p>
      </div>
      <div className="grid gap-6 border-t border-border/60 pt-5 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="min-h-20 max-w-xl" aria-live="polite">
          <p className="font-mono text-[10px] text-primary">
            {selectedNode.code}
          </p>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            {missingSelected
              ? "The 20-minute window passed without a recorded confirmation. Completed execution alone cannot tell you the business outcome."
              : selectedNode.detail}
          </p>
        </div>
        <div>
          <Button
            variant="outline"
            onClick={() => {
              setMissing(!missing)
              setSelectedNode(nodes[3])
            }}
            className="h-auto min-h-11 max-w-full whitespace-normal border-highlight/25 bg-highlight/5 text-left text-[11px] text-highlight"
          >
            {missing
              ? "Restore the confirmation"
              : "What if the confirmation never arrives?"}
            <span aria-hidden="true">↗</span>
          </Button>
          <p className="mt-2 text-[9px] text-muted-foreground sm:text-right">
            Interactive illustration · synthetic evidence
          </p>
        </div>
      </div>
    </MotionScene>
  )
}
