"use client"

import { useState } from "react"
import {
  Button,
  FlowmarkMark,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@flowmark/ui"
import { Arrow } from "../../app/components/brand"
import { docsUrl } from "../../app/components/site-links"
import { investigations } from "./evidence"

const clients = [
  {
    name: "Codex",
    context: "In your coding workspace",
    prompt:
      "Instrument appointment.book with Flowmark. Keep our existing business logic, report the booking result, and preserve the referral relationship.",
  },
  {
    name: "Cursor",
    context: "Beside the code you’re changing",
    prompt:
      "Compare the booking evidence around our latest release. Which reported outcomes changed, and which runs should I inspect?",
  },
  {
    name: "Claude Code",
    context: "From the terminal to the evidence",
    prompt:
      "Find SYN-BOOK-RECENT. Follow its related runs and explain which expected confirmation is missing, using recorded evidence.",
  },
  {
    name: "Your agent",
    context: "Through scoped MCP access",
    prompt:
      "Read the process context for Cedar Health. Return the recorded outcome, supporting evidence and anything the data cannot establish.",
  },
] as const

export function AgentExperience() {
  const [client, setClient] = useState<string>(clients[0].name)
  const example = investigations[0]!
  return (
    <Tabs
      value={client}
      onValueChange={(value) => {
        if (typeof value === "string") {
          setClient(value)
        }
      }}
      className="gap-0 overflow-hidden rounded-xl border border-primary/25 bg-card shadow-[0_24px_80px_-24px_#000,0_0_70px_-40px_#b9f59750]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-primary/10 bg-[linear-gradient(110deg,#b9f59710,transparent_70%)] px-5 py-4">
        <div className="flex items-center gap-2 text-xs">
          <FlowmarkMark className="size-4 text-primary" />
          Connect your agent
        </div>
        <span className="rounded border border-primary/20 bg-primary/5 px-2 py-1 font-mono text-[9px] text-primary">
          MCP
        </span>
      </div>
      <TabsList
        aria-label="Agent integration examples"
        variant="line"
        className="w-full flex-wrap justify-start gap-3 border-b border-border px-5 pb-1 sm:gap-5"
      >
        {clients.map((item) => (
          <TabsTrigger
            key={item.name}
            value={item.name}
            className="h-11 flex-none px-0 text-[11px] after:bottom-[-5px]"
          >
            {item.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {clients.map((item) => (
        <TabsContent key={item.name} value={item.name} className="p-5 sm:p-7">
          <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            {item.context}
          </p>
          <div className="mt-5 rounded-lg border border-border bg-background/70 p-4">
            <p className="mb-2 font-mono text-[8px] uppercase tracking-widest text-muted-foreground">
              You / {item.name}
            </p>
            <span className="text-primary" aria-hidden="true">
              ›
            </span>
            <span className="ml-2 text-xs leading-7 text-foreground/90">
              {item.prompt}
            </span>
          </div>
          <div className="mt-4 rounded-lg border border-primary/15 bg-[linear-gradient(135deg,#b9f59708,transparent)] p-4">
            <div className="flex items-center justify-between gap-3 text-[10px]">
              <span className="flex items-center gap-2">
                <FlowmarkMark className="size-3.5 text-primary" />
                Process evidence
              </span>
              <code className="text-primary/80">get_run</code>
            </div>
            <p className="mt-4 font-mono text-[11px]">
              {example.snapshot.workflow}
            </p>
            <p className="mt-1.5 break-all text-[9px] text-muted-foreground">
              {example.reference} · {example.customer}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-3 text-[10px]">
              <div>
                <dt className="text-muted-foreground">Execution</dt>
                <dd className="mt-1.5 text-success">Completed · 1.8 s</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Confirmation</dt>
                <dd className="mt-1.5 text-warning">Not recorded</dd>
              </div>
            </dl>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-[9px] text-muted-foreground">
            <span className="rounded border border-border px-2 py-1">
              Project-scoped
            </span>
            <span className="rounded border border-border px-2 py-1">
              Read-only evidence
            </span>
            <span className="rounded border border-border px-2 py-1">
              Explicit authorization
            </span>
          </div>
          <p className="mt-4 text-[10px] leading-5 text-muted-foreground">
            Illustrative agent interaction · synthetic Meridian Health context
          </p>
          <Button asChild variant="link" className="mt-3 h-11 px-0 text-xs">
            <a href={docsUrl}>
              Explore agent-assisted instrumentation <Arrow />
            </a>
          </Button>
        </TabsContent>
      ))}
    </Tabs>
  )
}
