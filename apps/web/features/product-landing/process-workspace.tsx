"use client"

import { useRef, useState } from "react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  FlowmarkMark,
  RunSnapshot,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@flowmark/ui"
import { bookingSnapshot } from "./evidence"
import { OutcomeChart } from "./outcome-chart"
import { processHealth } from "./process-data"
import { ProcessJourney } from "./process-journey"
import { ReleaseComparison } from "./release-comparison"

export function ProcessWorkspace() {
  const [view, setView] = useState("health")
  const [inspecting, setInspecting] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const comparisonTab = useRef<HTMLButtonElement>(null)
  const journeyTab = useRef<HTMLButtonElement>(null)
  const openComparison = () => {
    setView("releases")
    comparisonTab.current?.focus()
  }
  const openJourney = () => {
    setView("journey")
    journeyTab.current?.focus()
  }

  return (
    <div id="studio" className="relative scroll-mt-24 text-left">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-muted-foreground">
        <span>
          <span className="mr-2 text-highlight">↳</span> A living view of your
          application
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em]">
          Interactive product example · synthetic data
        </span>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-8 inset-y-12 -z-10 bg-[radial-gradient(ellipse_at_50%_50%,var(--studio-glow),transparent_70%)] blur-3xl"
      />
      <div className="overflow-hidden rounded-xl border border-highlight/25 bg-card shadow-[0_28px_100px_-30px_#000]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/40 px-5 py-3.5 sm:px-7">
          <span className="flex items-center gap-2.5 text-xs font-medium">
            <FlowmarkMark className="size-5 text-primary" />
            Flowmark{" "}
            <span className="font-normal text-muted-foreground">/</span>{" "}
            <span className="text-highlight">Studio</span>
          </span>
          <span className="font-mono text-[9px] text-muted-foreground">
            MERIDIAN HEALTH{" "}
            <span className="ml-2 rounded border border-border px-1.5 py-1">
              DEMO
            </span>
          </span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4 px-5 pt-6 pb-5 sm:px-8">
          <div>
            <p className="text-[10px] text-muted-foreground">
              Processes <span className="mx-2 text-border">/</span> Scheduling
            </p>
            <h2 className="mt-2 text-xl font-medium tracking-tight sm:text-2xl">
              Appointment booking<span className="text-primary">.</span>
            </h2>
          </div>
          <span className="rounded-full border border-warning/20 bg-warning/5 px-3 py-1.5 text-[10px] text-warning">
            ↗ One change worth investigating
          </span>
        </div>
        <Tabs
          value={view}
          onValueChange={(value) => {
            if (typeof value === "string") {
              setView(value)
            }
          }}
          className="gap-0"
        >
          <div className="border-b border-border px-4 sm:px-7">
            <TabsList
              variant="line"
              aria-label="Explore the booking process"
              className="w-full justify-start gap-2 p-0 sm:gap-6"
            >
              <TabsTrigger
                value="health"
                className="h-11 min-w-0 scroll-mt-24 flex-1 px-1 text-[10px] whitespace-normal sm:flex-none sm:text-[11px] after:bottom-0"
              >
                Process health
              </TabsTrigger>
              <TabsTrigger
                ref={journeyTab}
                value="journey"
                className="h-11 min-w-0 scroll-mt-24 flex-1 px-1 text-[10px] whitespace-normal sm:flex-none sm:text-[11px] after:bottom-0"
              >
                Journey
              </TabsTrigger>
              <TabsTrigger
                ref={comparisonTab}
                value="releases"
                className="h-11 min-w-0 scroll-mt-24 flex-1 px-1 text-[10px] whitespace-normal sm:flex-none sm:text-[11px] after:bottom-0"
              >
                Compare releases
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="health">
            <div className="grid lg:grid-cols-[1.6fr_1fr]">
              <div className="p-5 sm:p-8">
                <OutcomeChart />
              </div>
              <aside className="flex flex-col border-t border-border bg-background/30 p-5 sm:p-8 lg:border-t-0 lg:border-l">
                <p className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-highlight">
                  <span aria-hidden="true">✳</span> Worth a closer look
                </p>
                <h3 className="mt-5 text-xl leading-snug font-medium tracking-tight">
                  Bookings are completing.
                  <br />
                  <span className="text-warning">
                    Fewer are being confirmed.
                  </span>
                </h3>
                <p className="mt-4 text-xs leading-6 text-muted-foreground">
                  Confirmation rates fell after the latest release. Execution
                  completion and reporting coverage stayed stable.
                </p>
                <p className="mt-4 border-l border-highlight/40 pl-3 text-[11px] leading-5 text-muted-foreground">
                  Based on two comparable cohorts.
                  <br />
                  Every finding leads back to evidence.
                </p>
                <Button
                  variant="outline"
                  onClick={openComparison}
                  className="mt-6 h-10 text-xs"
                >
                  Explore the change <span aria-hidden="true">→</span>
                </Button>
              </aside>
            </div>
          </TabsContent>
          <TabsContent value="journey">
            <ProcessJourney
              onInspect={(button) => {
                trigger.current = button
                setInspecting(true)
              }}
            />
          </TabsContent>
          <TabsContent value="releases">
            <ReleaseComparison onJourney={openJourney} />
          </TabsContent>
        </Tabs>
        <div className="grid border-t border-border sm:grid-cols-3">
          {processHealth.map((item) => (
            <div
              key={item.label}
              className="border-border px-5 py-4 not-last:border-b sm:px-7 sm:not-last:border-r sm:not-last:border-b-0"
            >
              <p className="text-[10px] text-muted-foreground">{item.label}</p>
              <p
                className={`mt-2 flex items-center gap-2 text-xs ${item.color}`}
              >
                <span
                  aria-hidden="true"
                  className={`size-1.5 rounded-full ${item.dot}`}
                />
                {item.value}
              </p>
              <p className="mt-1.5 text-[10px] leading-5 text-muted-foreground">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-background/30 px-5 py-3 font-mono text-[9px] leading-5 text-muted-foreground sm:px-7">
          <span>Fictional organization · illustrative product experience</span>
          <span>Observed 24 Oct 2026 · 11:00 UTC</span>
        </div>
      </div>
      <Dialog open={inspecting} onOpenChange={setInspecting}>
        <DialogContent
          initialFocus={heading}
          finalFocus={trigger}
          className="p-4 sm:max-w-4xl sm:p-6"
        >
          <DialogHeader>
            <DialogTitle ref={heading} tabIndex={-1}>
              Booking execution evidence
            </DialogTitle>
            <DialogDescription>
              Meridian Health · fictional organization · synthetic observations
            </DialogDescription>
          </DialogHeader>
          <RunSnapshot {...bookingSnapshot} />
        </DialogContent>
      </Dialog>
      <button
        type="button"
        onClick={(event) => {
          trigger.current = event.currentTarget
          setInspecting(true)
        }}
        className="mt-4 inline-flex min-h-9 items-center gap-2 text-[11px] text-muted-foreground hover:text-primary"
      >
        Inspect the underlying booking run <span aria-hidden="true">↗</span>
      </button>
    </div>
  )
}
