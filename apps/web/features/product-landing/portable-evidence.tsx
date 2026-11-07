"use client"

import { useRef, useState } from "react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FlowmarkMark,
  RunSnapshot,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@flowmark/ui"
import { Arrow } from "../../app/components/brand"
import { investigations } from "./evidence"

function EvidenceCard() {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const example = investigations[0]!
  return (
    <div className="overflow-hidden rounded-lg border border-primary/20 bg-card shadow-[0_12px_32px_-16px_#000]">
      <div className="flex items-center gap-2 border-b border-border bg-primary/5 px-4 py-3 text-[10px]">
        <FlowmarkMark className="size-4 text-primary" />
        <span className="font-medium">Flowmark evidence</span>
        <span className="ml-auto text-muted-foreground">
          Same process. Same facts.
        </span>
      </div>
      <div className="p-4 sm:p-5">
        <p className="font-mono text-xs">appointment.book</p>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Cedar Health · {example.reference}
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-4 border-y border-border py-4">
          <div>
            <dt className="text-[10px] text-muted-foreground">Execution</dt>
            <dd className="mt-2 flex items-center gap-1.5 text-xs text-success">
              <span className="size-1 rounded-full bg-current" />
              Completed
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">Confirmation</dt>
            <dd className="mt-2 text-xs text-warning">Not recorded</dd>
          </div>
        </dl>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[9px] leading-5 text-muted-foreground">
            Synthetic evidence
            <br />
            24 Oct, 11:00 UTC
          </span>
          <Dialog>
            <DialogTrigger
              render={
                <Button variant="link" className="h-11 px-0 text-[11px]" />
              }
            >
              Inspect evidence <Arrow />
            </DialogTrigger>
            <DialogContent
              initialFocus={titleRef}
              className="p-3 sm:max-w-4xl sm:p-6"
            >
              <DialogHeader>
                <DialogTitle ref={titleRef} tabIndex={-1}>
                  One investigation, wherever you work
                </DialogTitle>
                <DialogDescription>
                  Meridian Health · fictional organization · synthetic data
                </DialogDescription>
              </DialogHeader>
              <RunSnapshot {...example.snapshot} />
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}

export function PortableEvidence() {
  const [host, setHost] = useState("mcp")
  return (
    <Tabs
      value={host}
      onValueChange={(value) => {
        if (typeof value === "string") {
          setHost(value)
        }
      }}
      className="gap-0 overflow-hidden rounded-xl border border-border bg-background/75"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2 sm:px-5">
        <TabsList
          aria-label="Portable evidence surfaces"
          variant="line"
          className="gap-4 p-0 [&_[data-slot=tabs-trigger]]:after:bg-highlight"
        >
          <TabsTrigger value="mcp" className="h-10 px-0 text-[11px]">
            MCP App
          </TabsTrigger>
          <TabsTrigger value="custom" className="h-10 px-0 text-[11px]">
            Your internal tool
          </TabsTrigger>
        </TabsList>
        <span className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground">
          Interactive example
        </span>
      </div>
      <TabsContent value="mcp" className="p-4 sm:p-6">
        <div className="mb-4 flex items-start gap-2.5 text-[11px] leading-6 text-muted-foreground">
          <span aria-hidden="true" className="text-primary">
            ›
          </span>
          <p>What happened to Cedar Health’s booking?</p>
        </div>
        <EvidenceCard />
      </TabsContent>
      <TabsContent value="custom" className="p-4 sm:p-6">
        <div className="mb-4 flex min-h-6 items-center justify-between gap-3 text-[10px]">
          <span className="text-muted-foreground">
            Customer workspace <span className="mx-1.5">/</span> Integrations
          </span>
          <span className="text-primary">Cedar Health</span>
        </div>
        <EvidenceCard />
      </TabsContent>
    </Tabs>
  )
}
