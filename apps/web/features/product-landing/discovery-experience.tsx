"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import {
  Button,
  FlowmarkMark,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@flowmark/ui"

function DiscoveredProcess() {
  const [reviewed, setReviewed] = useState(false)
  return (
    <div className="grid min-h-80 lg:grid-cols-[0.85fr_1.15fr]">
      <div className="relative overflow-hidden border-b border-border bg-background/50 p-6 sm:p-8 lg:border-r lg:border-b-0">
        <p className="font-mono text-[10px] text-muted-foreground">
          YOUR APPLICATION
        </p>
        <div className="mt-7 space-y-3 font-mono text-[10px] sm:text-[11px]">
          <p className="text-muted-foreground">⌄ src /</p>
          <p className="ml-2 break-all border-l sm:ml-4 border-border py-2 pl-4 text-primary">
            routes/book-appointment.ts
          </p>
          <p className="ml-2 break-all border-l sm:ml-4 border-border py-2 pl-4 text-foreground/80">
            integrations/orbit.ts
          </p>
          <p className="ml-2 break-all border-l sm:ml-4 border-highlight/50 py-2 pl-4 text-highlight">
            webhooks/confirmation.ts
          </p>
          <p className="ml-2 break-all border-l sm:ml-4 border-border py-2 pl-4 text-muted-foreground">
            tests/booking.test.ts
          </p>
        </div>
        <div className="mt-7 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="h-px flex-1 bg-linear-to-r from-transparent to-primary/40" />
          Code + execution context
          <span aria-hidden="true" className="text-primary">
            →
          </span>
        </div>
      </div>
      <div className="p-6 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-xs">
            <FlowmarkMark className="size-4 text-primary" />
            Discovered process
          </span>
          <span className="rounded-full border border-highlight/30 bg-highlight/5 px-2.5 py-1 text-[10px] text-highlight">
            Candidate
          </span>
        </div>
        <h3 className="mt-7 text-2xl font-medium tracking-tight">
          Appointment booking
        </h3>
        <p className="mt-3 max-w-md text-xs leading-6 text-muted-foreground">
          A request is accepted by Orbit. A later callback confirms the booking.
          Two code paths, one business process.
        </p>
        <div className="mt-6 flex flex-wrap gap-2 text-[10px]">
          {[
            "3 supporting code paths",
            "1 observed integration",
            "1 open question",
          ].map((label) => (
            <span
              key={label}
              className="rounded-md border border-border px-2.5 py-1.5 text-muted-foreground"
            >
              {label}
            </span>
          ))}
        </div>
        <Button
          variant="outline"
          aria-expanded={reviewed}
          aria-controls="candidate-review"
          onClick={() => setReviewed(!reviewed)}
          className="mt-6 h-10 text-xs"
        >
          {reviewed ? "Close candidate review" : "Review discovered process"}
          <span aria-hidden="true">{reviewed ? "−" : "→"}</span>
        </Button>
        <div
          id="candidate-review"
          hidden={!reviewed}
          className="mt-5 border-l border-highlight/50 pl-4 text-xs leading-6 motion-safe:animate-arrive"
        >
          <p className="text-highlight">Meaning needs your review</p>
          <p className="mt-2 text-muted-foreground">
            The callback relationship is inferred from code. Confirm whether
            “confirmed” means a provider acknowledgement, and whether 20 minutes
            is the right expectation.
          </p>
          <p className="mt-3 text-[10px] text-muted-foreground">
            Example review only · no definition is published
          </p>
        </div>
      </div>
    </div>
  )
}

export function DiscoveryExperience({ precision }: { precision: ReactNode }) {
  return (
    <Tabs
      defaultValue="assisted"
      className="mt-10 gap-0 overflow-hidden rounded-xl border border-border bg-card"
    >
      <TabsList
        aria-label="Ways to observe your application"
        variant="line"
        className="w-full justify-start gap-0 border-b border-border px-2 py-0 sm:gap-5 sm:px-6"
      >
        <TabsTrigger
          value="automatic"
          className="h-14 min-w-0 px-1 text-[10px] whitespace-normal after:bottom-0 sm:flex-none sm:px-3 sm:text-[11px]"
        >
          Automatic
        </TabsTrigger>
        <TabsTrigger
          value="assisted"
          className="h-14 min-w-0 px-1 text-[10px] whitespace-normal after:bottom-0 sm:flex-none sm:px-3 sm:text-[11px]"
        >
          Agent-assisted
        </TabsTrigger>
        <TabsTrigger
          value="precision"
          className="h-14 min-w-0 px-1 text-[10px] whitespace-normal after:bottom-0 sm:flex-none sm:px-3 sm:text-[11px]"
        >
          Precision SDK
        </TabsTrigger>
      </TabsList>
      <TabsContent value="assisted">
        <DiscoveredProcess />
      </TabsContent>
      <TabsContent value="automatic">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-2">
          <div>
            <p className="font-mono text-[10px] text-primary">
              TECHNICAL CONTEXT, AUTOMATICALLY
            </p>
            <h3 className="mt-6 text-2xl font-medium tracking-tight">
              Start with what’s running.
            </h3>
            <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">
              See requests, database calls and integration behavior through
              selected runtime adapters. Connect useful context to a process
              when you’re ready.
            </p>
            <p className="mt-6 text-[11px] text-muted-foreground">
              You choose what is collected. Safe, bounded defaults come first.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background/60 p-5">
            <p className="mb-5 flex justify-between font-mono text-[10px]">
              <span>POST /appointments</span>
              <span className="text-success">202 · 1.8 s</span>
            </p>
            <div className="space-y-5 border-l border-border pl-4 text-xs">
              <div>
                <p className="flex justify-between gap-3">
                  <span>Validate reference</span>
                  <span className="text-muted-foreground">24 ms</span>
                </p>
                <div className="mt-2 h-1.5 w-[12%] rounded-full bg-highlight/60" />
              </div>
              <div>
                <p className="flex justify-between gap-3">
                  <span>PostgreSQL · lookup</span>
                  <span className="text-muted-foreground">86 ms</span>
                </p>
                <div className="mt-2 ml-[12%] h-1.5 w-[22%] rounded-full bg-highlight/60" />
              </div>
              <div>
                <p className="flex justify-between gap-3">
                  <span>Orbit · submit booking</span>
                  <span className="text-muted-foreground">1.6 s</span>
                </p>
                <div className="mt-2 ml-[16%] h-1.5 w-[84%] rounded-full bg-primary/70" />
              </div>
            </div>
            <p className="mt-6 border-t border-border pt-4 text-[10px] leading-5 text-muted-foreground">
              Captured: operation, duration, status
              <br />
              Excluded: request bodies, credentials, query parameters
            </p>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="precision">{precision}</TabsContent>
      <div className="flex flex-wrap justify-between gap-2 border-t border-border px-6 py-3 text-[10px] leading-5 text-muted-foreground">
        <span>
          Three independent starting points. Combine them when useful.
        </span>
        <span>Synthetic application example</span>
      </div>
    </Tabs>
  )
}
