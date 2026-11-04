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
import { investigations, type InvestigationExample } from "./evidence"
import { StudioPreview } from "./studio-preview"

function AgentEvidence({
  example,
  onOpenEvidence,
}: {
  example: InvestigationExample
  onOpenEvidence: () => void
}) {
  return (
    <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[1fr_240px] lg:gap-10">
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          The same investigation, in your agent
        </p>
        <p className="mt-6 rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm">
          {example.question}
        </p>
        <div className="mt-6 flex gap-3">
          <FlowmarkMark className="mt-1 size-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-xs font-medium">
              Flowmark{" "}
              <span className="ml-2 font-mono text-[10px] font-normal text-muted-foreground">
                MCP
              </span>
            </p>
            <p className="mt-3 max-w-lg text-sm leading-7 text-muted-foreground">
              {example.agentAnswer}
            </p>
            <Button
              variant="outline"
              className="mt-5 h-auto max-w-full whitespace-normal py-2 text-left text-[11px]"
              onClick={onOpenEvidence}
            >
              View evidence · {example.reference} <Arrow />
            </Button>
          </div>
        </div>
      </div>
      <div className="border-t border-border pt-5 lg:border-t-0 lg:border-l lg:pl-6">
        <p className="text-xs font-medium">Answers with a trail.</p>
        <ul className="mt-5 space-y-4 text-xs leading-6 text-muted-foreground">
          <li>Explicit project and process context</li>
          <li>Structured, scoped tool results</li>
          <li>Evidence you can open in Studio</li>
          <li>Portable views in compatible MCP clients</li>
        </ul>
      </div>
    </div>
  )
}

export function StudioExperience() {
  const [surface, setSurface] = useState("studio")
  const [selection, setSelection] = useState(investigations[0]!.id)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const example = investigations.find((item) => item.id === selection)!

  return (
    <div id="studio" className="relative">
      <h2 className="sr-only">Explore Flowmark Studio</h2>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span>
          <span className="mr-2 text-primary">↳</span> One process. Every
          perspective.
        </span>
        <span className="font-mono text-[9px] uppercase tracking-widest">
          Interactive example · synthetic data
        </span>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-12 top-8 -bottom-12 -z-10 rounded-full bg-[radial-gradient(ellipse_at_50%_35%,var(--studio-glow),transparent_70%)] blur-3xl"
      />
      <div className="relative overflow-hidden rounded-xl border border-primary/25 bg-card shadow-[0_0_0_1px_#b9f59708,0_32px_100px_-28px_#000,0_0_90px_-40px_#b9f59760]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-primary/70 to-transparent"
        />
        <Tabs
          value={surface}
          onValueChange={(value) => {
            if (typeof value === "string") {
              setSurface(value)
            }
          }}
          className="gap-0"
        >
          <div className="flex flex-wrap items-center justify-between gap-1 border-b border-border px-3 sm:px-5">
            <TabsList
              aria-label="Explore Flowmark interfaces"
              variant="line"
              className="gap-4 p-0 [&_[data-active]]:text-primary"
            >
              <TabsTrigger
                value="studio"
                className="h-10 px-1 text-xs after:bottom-0"
              >
                Studio
              </TabsTrigger>
              <TabsTrigger
                value="agent"
                className="h-10 px-1 text-xs after:bottom-0"
              >
                Agent
              </TabsTrigger>
              <TabsTrigger
                value="api"
                className="h-10 px-1 text-xs after:bottom-0"
              >
                Structured data
              </TabsTrigger>
            </TabsList>
            <span className="hidden text-[10px] text-muted-foreground sm:block">
              Same context. Same evidence.
            </span>
          </div>
          <TabsContent value="studio">
            <StudioPreview
              selectedId={selection}
              onInspect={setSelection}
              open={evidenceOpen}
              onOpenChange={setEvidenceOpen}
            />
          </TabsContent>
          <TabsContent value="agent" className="lg:min-h-[420px]">
            <AgentEvidence
              example={example}
              onOpenEvidence={() => {
                setSurface("studio")
                setEvidenceOpen(true)
              }}
            />
          </TabsContent>
          <TabsContent value="api" className="lg:min-h-[420px]">
            <div className="grid gap-7 p-5 sm:p-8 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
                  Platform → Everywhere
                </p>
                <h3 className="mt-5 text-2xl font-medium tracking-tight">
                  Useful to a person.
                  <br />
                  Readable by a machine.
                </h3>
                <p className="mt-4 text-xs leading-6 text-muted-foreground">
                  Use structured process evidence in your own tools,
                  investigations and agent workflows. Keep the context and the
                  limits of what is known.
                </p>
                <p className="mt-5 text-[10px] text-muted-foreground">
                  Illustrative evidence document · not a request or credential
                </p>
              </div>
              <pre
                tabIndex={0}
                aria-label="Structured evidence JSON"
                className="overflow-x-auto rounded-lg border border-border bg-background p-5 font-mono text-[11px] leading-6 text-primary"
              >
                <code>
                  {JSON.stringify(
                    {
                      process: example.snapshot.workflow,
                      reference: example.reference,
                      customer: example.customer,
                      execution: "completed",
                      reportedResult: JSON.parse(
                        example.snapshot.milestones.at(-1)!.payload,
                      ),
                      evidence: example.steps.map((step) => step.name),
                      asOf: "2026-10-24T11:00:00Z",
                    },
                    null,
                    2,
                  )}
                </code>
              </pre>
            </div>
          </TabsContent>
        </Tabs>
        <div className="flex flex-wrap justify-between gap-2 border-t border-border bg-background/30 px-4 py-3 font-mono text-[9px] text-muted-foreground sm:px-5">
          <span>Meridian Health is fictional. All evidence is synthetic.</span>
          <span>Snapshot · 24 Oct, 11:00 UTC</span>
        </div>
      </div>
    </div>
  )
}
