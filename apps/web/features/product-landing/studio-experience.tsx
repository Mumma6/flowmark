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
  Input,
  RunSnapshot,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@flowmark/ui"
import { Arrow } from "../../app/components/brand"
import { investigations, type InvestigationExample } from "./evidence"

function EvidenceWorkspace({ example }: { example: InvestigationExample }) {
  const [stepIndex, setStepIndex] = useState(example.steps.length - 1)
  const dialogTitleRef = useRef<HTMLHeadingElement>(null)
  const step = example.steps[stepIndex]!

  return (
    <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_248px]">
      <div className="min-w-0 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Process investigation
          </span>
          <span className="flex items-center gap-2 text-[11px] text-success">
            <span className="size-1.5 rounded-full bg-current" />
            Execution completed
          </span>
        </div>
        <h3 className="mt-6 max-w-lg text-balance text-[25px] leading-[1.2] font-medium tracking-[-0.035em] sm:text-[30px]">
          {example.headline}
        </h3>
        <p className="mt-3 max-w-lg text-xs leading-6 text-muted-foreground">
          {example.explanation}
        </p>
        <div
          className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4"
          aria-label="Connected process evidence"
        >
          {example.steps.map((item, index) => (
            <Button
              key={item.name}
              variant="ghost"
              aria-pressed={stepIndex === index}
              onClick={() => setStepIndex(index)}
              className={`relative h-auto min-h-28 flex-col items-start justify-start gap-3 whitespace-normal rounded-lg border p-3 text-left text-foreground ${stepIndex === index ? "border-primary/50 bg-primary/5" : "border-border/70 bg-background/40 hover:bg-secondary"}`}
            >
              <span
                className={`grid size-6 place-items-center rounded-full border text-[10px] ${item.state === "attention" ? "border-warning/30 text-warning" : "border-success/30 text-success"}`}
              >
                {item.state === "attention" ? "!" : "✓"}
              </span>
              <span className="text-[11px] font-medium">{item.label}</span>
              <span className="text-[10px] font-normal text-muted-foreground">
                {item.detail}
              </span>
              {index < 3 && (
                <span
                  className="absolute -right-2.5 top-5 z-10 hidden bg-card text-muted-foreground sm:block"
                  aria-hidden="true"
                >
                  <Arrow />
                </span>
              )}
            </Button>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          <span className="rounded border border-border px-2 py-1">
            {example.customer}
          </span>
          <span className="rounded border border-border px-2 py-1">
            {example.integration}
          </span>
          <span className="rounded border border-border px-2 py-1 font-mono">
            {example.reference}
          </span>
        </div>
      </div>
      <aside
        className="min-w-0 border-t border-border bg-background/35 p-5 lg:border-t-0 lg:border-l"
        aria-label="Selected evidence"
        aria-live="polite"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Evidence inspector
        </p>
        <div className="mt-7 flex items-center gap-2 text-xs">
          <span
            className={`size-1.5 rounded-full ${step.state === "attention" ? "bg-warning" : "bg-success"}`}
          />
          {step.label}
        </div>
        <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">
          {step.name}
        </p>
        <pre
          tabIndex={0}
          aria-label="Selected evidence JSON"
          className="mt-5 overflow-x-auto rounded-md border border-border bg-background p-3 font-mono text-[10px] leading-6 text-primary"
        >
          <code>{JSON.stringify(JSON.parse(step.payload), null, 2)}</code>
        </pre>
        <p className="mt-3 text-[10px] leading-5 text-muted-foreground">
          {step.name === "booking.confirmed"
            ? "Declared expectation · recorded observations."
            : "Application-reported evidence."}
          <br />
          Snapshot · 24 Oct, 11:00 UTC
        </p>
        <Dialog>
          <DialogTrigger
            render={
              <Button variant="outline" className="mt-6 h-10 w-full text-xs" />
            }
          >
            Inspect run <Arrow />
          </DialogTrigger>
          <DialogContent
            initialFocus={dialogTitleRef}
            className="p-3 sm:max-w-4xl sm:p-6"
          >
            <DialogHeader>
              <DialogTitle ref={dialogTitleRef} tabIndex={-1}>
                From process to recorded evidence
              </DialogTitle>
              <DialogDescription>
                Meridian Health · fictional organization · synthetic data
              </DialogDescription>
            </DialogHeader>
            <RunSnapshot {...example.snapshot} />
          </DialogContent>
        </Dialog>
      </aside>
    </div>
  )
}

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
  const [search, setSearch] = useState("")
  const example = investigations.find((item) => item.id === selection)!
  const matches = investigations.filter((item) =>
    `${item.title} ${item.reference} ${item.customer} ${item.integration}`
      .toLowerCase()
      .includes(search.toLowerCase().trim()),
  )
  const visible = matches.find((item) => item.id === selection) ?? matches[0]

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
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_24px_100px_-32px_#000]">
        <div className="flex min-h-14 items-center justify-between gap-4 border-b border-border bg-background/40 px-4 sm:px-5">
          <div className="flex items-center gap-3 text-xs">
            <FlowmarkMark className="size-5 text-primary" />
            <span className="font-medium">Meridian Health</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">Studio</span>
          </div>
          <span className="hidden rounded border border-border px-2 py-1 font-mono text-[9px] text-muted-foreground sm:block">
            Reference workspace
          </span>
        </div>
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
              className="gap-4 p-0"
            >
              <TabsTrigger
                value="studio"
                className="h-12 px-1 text-xs after:bottom-0"
              >
                Studio
              </TabsTrigger>
              <TabsTrigger
                value="agent"
                className="h-12 px-1 text-xs after:bottom-0"
              >
                Agent
              </TabsTrigger>
              <TabsTrigger
                value="api"
                className="h-12 px-1 text-xs after:bottom-0"
              >
                Structured data
              </TabsTrigger>
            </TabsList>
            <span className="hidden text-[10px] text-muted-foreground sm:block">
              Same context. Same evidence.
            </span>
          </div>
          <TabsContent value="studio" className="lg:min-h-[420px]">
            <div className="grid min-w-0 md:grid-cols-[190px_minmax(0,1fr)]">
              <aside
                className="border-b border-border bg-background/20 p-4 md:border-r md:border-b-0"
                aria-label="Example investigations"
              >
                <label
                  htmlFor="evidence-search"
                  className="mb-3 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
                >
                  Explore
                </label>
                <Input
                  id="evidence-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Find a process…"
                  className="h-9 text-[11px]"
                  type="search"
                />
                <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-1">
                  {matches.map((item) => (
                    <Button
                      key={item.id}
                      variant="ghost"
                      aria-pressed={visible?.id === item.id}
                      onClick={() => setSelection(item.id)}
                      className={`h-auto min-h-16 flex-col items-start gap-2 whitespace-normal px-3 py-3 text-left ${visible?.id === item.id ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
                    >
                      <span className="text-[11px]">{item.title}</span>
                      <span className="text-[9px] font-normal text-warning">
                        {item.result}
                      </span>
                    </Button>
                  ))}
                </div>
                <p className="mt-8 hidden text-[10px] leading-5 text-muted-foreground md:block">
                  Processes, customers and integrations.
                  <br />
                  <span className="text-foreground/70">
                    One connected context.
                  </span>
                </p>
              </aside>
              {visible ? (
                <EvidenceWorkspace key={visible.id} example={visible} />
              ) : (
                <div
                  className="grid min-h-80 place-content-center gap-3 p-8 text-center"
                  role="status"
                >
                  <h3 className="text-lg">No matching evidence</h3>
                  <p className="text-xs text-muted-foreground">
                    Try “booking”, “Cedar” or a reference.
                  </p>
                  <Button variant="outline" onClick={() => setSearch("")}>
                    Clear search
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="agent" className="lg:min-h-[420px]">
            <AgentEvidence
              example={visible ?? example}
              onOpenEvidence={() => {
                setSelection((visible ?? example).id)
                setSearch("")
                setSurface("studio")
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
                      process: (visible ?? example).snapshot.workflow,
                      reference: (visible ?? example).reference,
                      customer: (visible ?? example).customer,
                      execution: "completed",
                      reportedResult: JSON.parse(
                        (visible ?? example).snapshot.milestones.at(-1)!
                          .payload,
                      ),
                      evidence: (visible ?? example).steps.map(
                        (step) => step.name,
                      ),
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
