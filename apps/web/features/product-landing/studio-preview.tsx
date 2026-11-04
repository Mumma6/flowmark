"use client"

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
  NativeSelect,
  RunSnapshot,
  StudioChrome,
  StudioEvidenceList,
  StudioProcessPane,
  StudioWorkspace,
} from "@flowmark/ui"
import { useRef, useState } from "react"
import { Arrow } from "../../app/components/brand"
import { investigations } from "./evidence"

/** The real Studio presentation with fixed public fixtures and local interactions. */
export function StudioPreview({
  selectedId,
  onInspect,
  open,
  onOpenChange,
}: {
  selectedId: string
  onInspect: (id: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [process, setProcess] = useState("all")
  const [status, setStatus] = useState("all")
  const [query, setQuery] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const term = query.trim().toLowerCase()
  const matches = investigations.filter(
    (example) =>
      (process === "all" || example.snapshot.workflow === process) &&
      (status === "all" || example.snapshot.status === status) &&
      (!term ||
        example.snapshot.workflow.toLowerCase().includes(term) ||
        example.reference.toLowerCase() === term),
  )
  const example = investigations.find((item) => item.id === selectedId)!
  const clear = () => {
    setProcess("all")
    setStatus("all")
    setQuery("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="border-b border-border bg-background/90">
        <StudioChrome
          brand={
            <span className="flex shrink-0 items-center gap-2 text-base font-semibold tracking-tight">
              <FlowmarkMark className="size-7 text-primary" />
              <span className="hidden sm:inline">
                flowmark<span className="text-primary">.</span>
              </span>
              <span className="ml-1 hidden rounded border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium tracking-normal text-primary lg:inline">
                Studio
              </span>
            </span>
          }
          project={
            <span className="block truncate px-2 text-xs">Meridian Health</span>
          }
          search={
            <Button
              variant="outline"
              aria-label="Search example evidence"
              onClick={() => searchRef.current?.focus()}
              className="h-9 px-3 text-xs text-muted-foreground"
            >
              <span aria-hidden="true">⌕</span>
              <span className="hidden sm:inline">
                Search processes, runs, references…
              </span>
            </Button>
          }
          account={
            <span
              aria-label="Fictional workspace member"
              className="grid size-9 place-items-center rounded-full border border-border bg-card text-[10px] text-muted-foreground"
            >
              MH
            </span>
          }
          navigation={
            <div
              aria-label="Illustrated Studio navigation"
              className="flex min-w-0 gap-1 overflow-x-auto"
            >
              {["Explore", "Processes", "Insights", "Attention"].map(
                (label) => (
                  <span
                    key={label}
                    className={`relative flex min-h-10 shrink-0 items-center px-1 text-[10px] sm:px-4 sm:text-xs ${label === "Explore" ? "text-foreground after:absolute after:inset-x-1 after:bottom-0 after:h-px after:bg-primary sm:after:inset-x-3" : "text-muted-foreground"}`}
                  >
                    {label}
                  </span>
                ),
              )}
            </div>
          }
          utility={
            <span className="hidden px-2 py-3 text-[11px] text-muted-foreground md:block">
              Execution history ↗
            </span>
          }
        />
      </div>
      <div className="grid gap-7 bg-background px-4 py-8 sm:px-8">
        <div>
          <p className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <span
              className="size-1.5 rounded-full bg-primary"
              aria-hidden="true"
            />
            Studio / Explore
          </p>
          <h3 className="text-3xl font-medium tracking-[-0.045em] sm:text-[40px] sm:leading-tight">
            Follow the work.
          </h3>
          <p className="mt-3 max-w-lg text-xs leading-6 text-muted-foreground">
            Start with a process. Find its reported outcomes and the execution
            evidence behind them.
          </p>
        </div>
        <StudioWorkspace
          processes={
            <StudioProcessPane
              processes={investigations.map((item) => ({
                name: item.snapshot.workflow,
                runs: 1,
              }))}
              selected={process}
              onSelect={setProcess}
            />
          }
        >
          <section aria-label="Example execution evidence" className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-primary/5 px-5 py-4 sm:px-6">
              <h4 className="flex items-center gap-2.5 text-xs font-medium">
                <span
                  className="size-2 rounded-full border border-primary"
                  aria-hidden="true"
                />
                Execution evidence
              </h4>
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                Synthetic snapshot
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 border-b border-border p-4 sm:px-6 sm:py-5">
              <label className="min-w-0 flex-[1_1_220px]">
                <span className="sr-only">Filter example evidence</span>
                <Input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter runs by ID, process or exact reference…"
                  className="h-10 bg-background/60 text-xs"
                />
              </label>
              <Button
                variant="outline"
                onClick={clear}
                className="h-9 bg-transparent text-xs"
              >
                Clear filters
              </Button>
              <label className="grid w-full gap-2 text-xs text-muted-foreground lg:hidden">
                <span className="sr-only">Example process</span>
                <NativeSelect
                  aria-label="Example process"
                  value={process}
                  onChange={(event) => setProcess(event.target.value)}
                >
                  <option value="all">All processes</option>
                  {investigations.map((item) => (
                    <option key={item.id} value={item.snapshot.workflow}>
                      {item.snapshot.workflow}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
              <div
                aria-label="Example execution status"
                className="flex flex-wrap gap-1"
              >
                {["all", "Completed", "Failed", "No final outcome"].map(
                  (value) => (
                    <Button
                      key={value}
                      variant="ghost"
                      aria-pressed={status === value}
                      onClick={() => setStatus(value)}
                      className={`h-8 px-2.5 text-[10px] ${status === value ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
                    >
                      {value === "all" ? "All" : value}
                    </Button>
                  ),
                )}
              </div>
              <span
                aria-live="polite"
                className="text-[10px] text-muted-foreground"
              >
                {matches.length} matching{" "}
                {matches.length === 1 ? "run" : "runs"}
              </span>
            </div>
            <StudioEvidenceList
              runs={matches.map((item) => ({
                id: item.id,
                workflow: item.snapshot.workflow,
                externalId: item.reference,
                status: item.snapshot.status,
                highlights: item.snapshot.metrics.slice(0, 2),
                duration: item.snapshot.duration,
                timestamp: item.snapshot.startedAt,
              }))}
              renderLink={(run, { className, children }) => (
                <DialogTrigger
                  render={
                    <button
                      type="button"
                      className={`${className} w-full text-left`}
                    />
                  }
                  onClick={() => {
                    onInspect(run.id)
                  }}
                >
                  {children}
                </DialogTrigger>
              )}
            />
            {matches.length === 0 ? (
              <div
                role="status"
                className="grid justify-items-center gap-3 px-6 py-12 text-center"
              >
                <h4 className="text-base font-medium">
                  No evidence matches this view.
                </h4>
                <p className="text-xs text-muted-foreground">
                  Try another process or clear the conditions.
                </p>
                <Button variant="outline" onClick={clear} size="sm">
                  Clear filters
                </Button>
              </div>
            ) : null}
            <div className="flex flex-wrap justify-between gap-3 border-t border-border px-5 py-4 text-[10px] text-muted-foreground sm:px-6">
              <span>
                Showing {matches.length} of {investigations.length} · page 1
              </span>
              <span>
                Open a run to inspect its evidence <Arrow />
              </span>
            </div>
          </section>
        </StudioWorkspace>
        <p className="text-[10px] leading-6 text-muted-foreground">
          Reported completion does not verify business success. Meridian Health
          is fictional; this example uses synthetic data.
        </p>
      </div>
      <DialogContent
        initialFocus={titleRef}
        className="p-3 sm:max-w-4xl sm:p-6"
      >
        <DialogHeader>
          <DialogTitle ref={titleRef} tabIndex={-1}>
            {example.snapshot.workflow}
          </DialogTitle>
          <DialogDescription>
            Meridian Health · fictional organization · synthetic data
          </DialogDescription>
        </DialogHeader>
        <RunSnapshot key={example.id} {...example.snapshot} />
      </DialogContent>
    </Dialog>
  )
}
