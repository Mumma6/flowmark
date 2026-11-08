import { ArrowUpRight, Workflow } from "lucide-react"
import type { ReactNode } from "react"
import { Badge } from "./badge"
import { Button } from "./button"
import { cn } from "./utils"

/** Presentation only: applications own navigation, queries and authorization. */
export function StudioChrome({
  brand,
  project,
  search,
  account,
  navigation,
  utility,
}: {
  brand: ReactNode
  project: ReactNode
  search: ReactNode
  account: ReactNode
  navigation: ReactNode
  utility?: ReactNode
}) {
  return (
    <>
      <div className="mx-auto flex h-16 max-w-[1680px] items-center justify-between gap-3 px-4 sm:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-5">
          {brand}
          <span aria-hidden="true" className="hidden text-border sm:block">
            /
          </span>
          <div className="min-w-0 max-w-[240px] flex-1">{project}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          {search}
          {account}
        </div>
      </div>
      <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-3 px-2 sm:px-6">
        {navigation}
        {utility}
      </div>
    </>
  )
}

export function StudioWorkspace({
  processes,
  children,
  className,
}: {
  processes: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "grid min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]",
        className,
      )}
    >
      {processes}
      {children}
    </div>
  )
}

export function StudioProcessPane({
  processes,
  selected,
  onSelect,
  state,
  directory,
}: {
  processes:
    readonly { readonly name: string; readonly runs: number }[] | undefined
  selected: string
  onSelect: (name: string) => void
  state?: ReactNode
  directory?: ReactNode
}) {
  return (
    <aside
      aria-label="Process selection"
      className="hidden min-w-0 flex-col border-r border-border bg-background/35 lg:flex"
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-5">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Processes
        </h2>
        <span className="font-mono text-[10px] text-muted-foreground">
          {processes?.length ?? "—"}
        </span>
      </div>
      <div className="px-3 py-3">
        <Button
          variant="ghost"
          aria-pressed={selected === "all"}
          onClick={() => onSelect("all")}
          className={`h-9 w-full justify-start gap-2 px-3 text-xs ${selected === "all" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
        >
          <Workflow aria-hidden="true" className="size-3.5" />
          All processes
        </Button>
      </div>
      {state ? <div className="px-5">{state}</div> : null}
      {processes ? (
        <div className="max-h-[32rem] overflow-y-auto px-3 pb-4">
          {processes.map((process) => (
            <button
              key={process.name}
              type="button"
              aria-pressed={selected === process.name}
              onClick={() => onSelect(process.name)}
              className={`group mb-1 w-full rounded-lg border px-3 py-3 text-left transition-colors ${selected === process.name ? "border-primary/20 bg-primary/5" : "border-transparent hover:bg-secondary/70"}`}
            >
              <span
                className={`block break-words font-mono text-[11px] leading-5 ${selected === process.name ? "text-primary" : "text-foreground/80"}`}
              >
                {process.name}
              </span>
              <span className="mt-1.5 block text-[10px] text-muted-foreground">
                {process.runs.toLocaleString()} recorded{" "}
                {process.runs === 1 ? "run" : "runs"}
              </span>
            </button>
          ))}
          {processes.length === 0 ? (
            <p className="px-3 py-3 text-xs leading-6 text-muted-foreground">
              Processes appear when your application reports its first
              execution.
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="mt-auto border-t border-border p-5">
        <p className="text-[10px] leading-6 text-muted-foreground">
          Application-owned work.
          <br />
          Recorded evidence.
          <br />
          Shared understanding.
        </p>
        {directory}
      </div>
    </aside>
  )
}

export interface StudioEvidenceRun {
  readonly id: string
  readonly workflow: string
  readonly externalId: string
  readonly status: "Completed" | "Failed" | "No final outcome"
  readonly outcome?: string | null
  readonly untrusted?: boolean
  readonly highlights: readonly {
    readonly key?: string
    readonly label: string
    readonly value: string
  }[]
  readonly duration: string
  readonly timestamp: string
  readonly startedAt?: string
}

export function StudioEvidenceList({
  runs,
  renderLink,
  className,
}: {
  runs: readonly StudioEvidenceRun[]
  renderLink: (
    run: StudioEvidenceRun,
    props: { className: string; children: ReactNode },
  ) => ReactNode
  className?: string
}) {
  return (
    <ul
      aria-label="Execution evidence"
      className={cn("divide-y divide-border", className)}
    >
      {runs.map((run) => (
        <li key={run.id}>
          {renderLink(run, {
            className:
              "group grid gap-3 px-5 py-5 transition-colors hover:bg-primary/5 focus-visible:bg-primary/5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:px-6",
            children: (
              <>
                <div className="min-w-0">
                  <div className="flex min-w-0 items-start justify-between gap-3 sm:justify-start">
                    <p className="min-w-0 break-words font-mono text-[13px] font-medium tracking-tight group-hover:text-primary">
                      {run.workflow}
                    </p>
                    <Badge
                      className="shrink-0 gap-1.5"
                      variant={
                        run.status === "Completed"
                          ? "success"
                          : run.status === "Failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      <span
                        aria-hidden="true"
                        className="size-1.5 shrink-0 rounded-full bg-current"
                      />
                      {run.status}
                    </Badge>
                  </div>
                  <div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span
                      className="max-w-full truncate font-mono"
                      title={run.externalId}
                    >
                      {run.externalId}
                    </span>
                    <span>
                      Outcome:{" "}
                      <span className="text-foreground/80">
                        {run.outcome ?? "Not reported"}
                      </span>
                    </span>
                    {run.untrusted ? (
                      <span className="text-warning">
                        Untrusted browser report
                      </span>
                    ) : null}
                  </div>
                  {run.highlights.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                      {run.highlights.map((item) => (
                        <span
                          key={item.key ?? item.label}
                          className="break-all"
                        >
                          <span className="text-muted-foreground">
                            {item.label}
                          </span>{" "}
                          <span className="tabular-nums">{item.value}</span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-5 text-[10px] text-muted-foreground sm:justify-end">
                  <div className="flex items-center gap-4 sm:grid sm:gap-1.5 sm:text-right">
                    <span className="font-mono tabular-nums text-foreground/80">
                      {run.duration}
                    </span>
                    <time dateTime={run.startedAt}>{run.timestamp}</time>
                  </div>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary"
                  />
                </div>
              </>
            ),
          })}
        </li>
      ))}
    </ul>
  )
}
