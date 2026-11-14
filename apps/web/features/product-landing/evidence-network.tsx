"use client"

import { useState } from "react"
import { Button, FlowmarkMark, cn } from "@flowmark/ui"
import { MotionScene, SignalPath } from "./motion"
import { ProcessIcon, type ProcessIconName } from "./process-icon"

const perspectives = [
  {
    name: "Your people",
    label: "Studio",
    icon: "person",
    question: "Did the import process every record?",
    answer:
      "The job completed. It reported 960 imported records and 40 skipped out of 1,000. Your team can inspect the skipped records and their reported reasons.",
    context: "Visual journeys · process health · shared definitions",
    position: "left-[15%]",
  },
  {
    name: "Your agents",
    label: "MCP",
    icon: "agent",
    question: "What changed — and where should I look?",
    answer:
      "The import now reports more skipped records after a release. Your coding agent follows the changed result to contributing runs and affected code.",
    context: "Codex · Cursor · Claude Code · any MCP client",
    position: "left-[50%]",
  },
  {
    name: "Your tools",
    label: "API",
    icon: "request",
    question: "Can this understanding travel with us?",
    answer:
      "Bring authorized process evidence into internal tools, reports and customer experiences. The definition and its historical context travel with the result.",
    context: "APIs · integrations · portable evidence",
    position: "left-[85%]",
  },
] as const satisfies readonly {
  name: string
  label: string
  icon: ProcessIconName
  question: string
  answer: string
  context: string
  position: string
}[]

export function EvidenceNetwork() {
  const [selected, setSelected] = useState<(typeof perspectives)[number]>(
    perspectives[1],
  )
  return (
    <MotionScene className="mt-10">
      <div className="relative h-[360px] sm:h-[400px]">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,var(--hero-glow),transparent_65%)]"
        />
        <svg
          viewBox="0 0 1000 400"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
          aria-hidden="true"
        >
          <SignalPath
            d="M500 100 C500 220 150 160 150 290"
            active={selected.label === "Studio"}
          />
          <SignalPath
            d="M500 100 V290"
            active={selected.label === "MCP"}
            className="text-highlight"
          />
          <SignalPath
            d="M500 100 C500 220 850 160 850 290"
            active={selected.label === "API"}
          />
          <path
            d="M500 125 C700 210 900 190 950 310M500 125 C300 210 100 190 50 310"
            fill="none"
            stroke="currentColor"
            className="text-primary/5"
          />
        </svg>
        <div className="absolute top-[25%] left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="flex items-center gap-4 rounded-2xl border border-primary/30 bg-background px-5 py-5 shadow-[0_0_80px_-15px_#b9f59725] sm:gap-6 sm:px-8">
            <FlowmarkMark className="size-8 shrink-0 text-primary" />
            <div>
              <p className="whitespace-nowrap text-sm sm:text-base">
                One shared understanding
              </p>
              <p className="mt-2 font-mono text-[8px] uppercase tracking-wider text-muted-foreground sm:text-[9px]">
                Meaning + history + evidence
              </p>
            </div>
          </div>
        </div>
        {perspectives.map((item) => (
          <div
            key={item.label}
            className={cn(
              "absolute top-[72.5%] -translate-x-1/2 -translate-y-1/2 text-center",
              item.position,
            )}
          >
            <Button
              variant="outline"
              aria-label={`Explore evidence for ${item.name.toLowerCase()}`}
              aria-pressed={selected.label === item.label}
              onClick={() => setSelected(item)}
              className={cn(
                "mx-auto flex size-15 rounded-2xl border-border bg-background text-muted-foreground transition-[color,border-color,box-shadow,transform] duration-500 motion-safe:hover:-translate-y-1 sm:size-20 [&_svg]:size-6",
                selected.label === item.label &&
                  "border-highlight/60 text-highlight shadow-[0_0_45px_-15px_#b7a3ff50]",
              )}
            >
              <ProcessIcon name={item.icon} />
            </Button>
            <p className="absolute top-full left-1/2 mt-4 w-28 -translate-x-1/2 text-xs">
              {item.name}
            </p>
            <p className="absolute top-full left-1/2 mt-10 w-28 -translate-x-1/2 font-mono text-[9px] text-muted-foreground">
              {item.label}
            </p>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-7 max-w-2xl text-center" aria-live="polite">
        <h3 className="text-2xl leading-snug font-medium tracking-tight sm:text-3xl">
          {selected.question}
        </h3>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
          {selected.answer}
        </p>
        <p className="mt-6 font-mono text-[9px] text-highlight sm:text-[10px]">
          {selected.context}
        </p>
      </div>
      <p className="mt-8 text-center text-[9px] text-muted-foreground">
        Illustrative perspectives. People and agents see the evidence their
        permissions allow.
      </p>
    </MotionScene>
  )
}
