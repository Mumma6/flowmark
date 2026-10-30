"use client"

import { useId, useState, type ReactNode } from "react"
import { Badge } from "./badge"
import { Button } from "./button"

export interface RunSnapshotMetric {
  readonly label: string
  readonly value: string
  readonly note: string
}

export interface RunSnapshotMilestone {
  readonly id: string
  readonly label: string
  readonly time: string
  readonly kind: "checkpoint" | "progress" | "error" | "completed" | "failed"
  readonly title: string
  readonly description: string
  readonly payload: string
  readonly note: string
  readonly progress?: {
    readonly completed: number
    readonly total?: number | null
    readonly unit?: string | null
  }
}

export interface RunSnapshotProps {
  readonly workflow: string
  readonly externalId: string
  readonly environment?: string | null
  readonly release?: string | null
  readonly startedAt: string
  readonly duration: string
  readonly status: "Completed" | "Failed" | "No final outcome"
  readonly metrics: readonly RunSnapshotMetric[]
  readonly milestones: readonly RunSnapshotMilestone[]
  readonly actions?: ReactNode
  readonly emptyResult?: string
  readonly evidenceNote?: string
}

const markerClasses: Record<RunSnapshotMilestone["kind"], string> = {
  checkpoint: "text-primary border-primary/40",
  completed: "text-success border-success/40",
  failed: "text-destructive border-destructive/40",
  error: "text-warning border-warning/40",
  progress: "text-info border-info/40",
}

function MilestoneMarker({ kind }: { kind: RunSnapshotMilestone["kind"] }) {
  return (
    <span
      aria-hidden="true"
      className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${markerClasses[kind]}`}
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        {kind === "completed" ? (
          <path
            d="m4 8 2.5 2.5L12 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : kind === "error" || kind === "failed" ? (
          <path
            d="M8 4v5m0 2v1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        ) : (
          <circle cx="8" cy="8" r="2.5" fill="currentColor" />
        )}
      </svg>
    </span>
  )
}

/** The same run presentation is used with live dashboard data and landing fixtures. */
export function RunSnapshot({
  workflow,
  externalId,
  environment,
  release,
  startedAt,
  duration,
  status,
  metrics,
  milestones,
  actions,
  emptyResult = "No business result recorded.",
  evidenceNote = "Select a recorded milestone to inspect its payload.",
}: RunSnapshotProps) {
  const evidenceId = useId()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected =
    milestones.find((item) => item.id === selectedId) ?? milestones.at(-1)
  return (
    <section
      className="min-w-0 overflow-hidden rounded-xl border border-border bg-card text-card-foreground"
      aria-label={`${workflow} run summary`}
    >
      <div className="p-4 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="break-all text-lg font-medium tracking-tight sm:text-xl">
                {workflow}
              </h2>
              <Badge
                variant={
                  status === "Completed"
                    ? "success"
                    : status === "Failed"
                      ? "destructive"
                      : "secondary"
                }
              >
                <span
                  aria-hidden="true"
                  className="size-1.5 shrink-0 rounded-full bg-current"
                />
                {status}
              </Badge>
            </div>
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground sm:text-xs">
              <span className="break-all">{externalId}</span>
              {environment && <span>{environment}</span>}
              {release && <span>Release {release}</span>}
              <span>{startedAt}</span>
            </p>
          </div>
          <span className="rounded-md border border-border bg-secondary/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
            {duration} · run duration
          </span>
        </div>
        {metrics.length > 0 ? (
          <dl className="mt-6 grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-background/30 sm:grid-cols-4">
            {metrics.map((metric, index) => (
              <div
                key={`${metric.label}-${index}`}
                className="min-w-0 border-border p-4 odd:border-r [&:nth-child(n+3)]:border-t sm:border-r sm:last:border-r-0 sm:[&:nth-child(n+3)]:border-t-0"
              >
                <dt className="break-words text-[11px] text-muted-foreground">
                  {metric.label}
                </dt>
                <dd className="mt-2 break-words text-[28px] leading-tight font-medium tracking-tight tabular-nums">
                  {metric.value}
                </dd>
                <dd className="mt-2 text-[10px] text-muted-foreground">
                  {metric.note}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-6 text-sm leading-7 text-muted-foreground">
            {emptyResult}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-xs leading-6 text-muted-foreground">
            Application-reported result · not independently verified
          </p>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
        {milestones.length > 0 && (
          <div className="mt-5 border-t border-border pt-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-medium">Recorded milestones</h3>
              <p className="text-[10px] leading-5 text-muted-foreground">
                {evidenceNote}
              </p>
            </div>
            <div
              className={`grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 ${milestones.length === 6 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}
            >
              {milestones.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  aria-pressed={selected?.id === item.id}
                  aria-controls={evidenceId}
                  onClick={() => setSelectedId(item.id)}
                  className={`h-auto min-h-[80px] items-start justify-start gap-2.5 rounded-lg border p-3 text-left whitespace-normal transition-colors sm:gap-3 sm:p-4 ${selected?.id === item.id ? "border-primary/40 bg-primary/[0.06]" : "border-border hover:border-primary/20"}`}
                >
                  <MilestoneMarker kind={item.kind} />
                  <span className="min-w-0">
                    <span className="block break-words text-xs font-medium">
                      {item.label}
                    </span>
                    <span className="mt-1.5 block font-mono text-[10px] font-normal text-muted-foreground">
                      {item.time}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
            {selected && (
              <div className="mt-4 grid overflow-hidden rounded-lg border border-border lg:grid-cols-[1.1fr_0.9fr]">
                <div
                  id={evidenceId}
                  aria-live="polite"
                  aria-atomic="true"
                  className="min-w-0 p-4 sm:p-5"
                >
                  <p className="text-[10px] text-primary">{selected.note}</p>
                  <h4 className="mt-3 break-words text-lg leading-snug font-medium tracking-tight sm:text-xl">
                    {selected.title}
                  </h4>
                  <p className="mt-2 max-w-md text-xs leading-6 text-muted-foreground">
                    {selected.description}
                  </p>
                  {selected.progress && (
                    <div className="mt-4 border-t border-border pt-3">
                      <p className="text-[10px] leading-5 text-muted-foreground">
                        Last reported progress: {selected.progress.completed}
                        {selected.progress.total != null
                          ? ` / ${selected.progress.total}`
                          : ""}{" "}
                        {selected.progress.unit}
                      </p>
                      {selected.progress.total != null &&
                        selected.progress.total > 0 && (
                          <progress
                            aria-label="Last reported progress"
                            max={selected.progress.total}
                            value={selected.progress.completed}
                            className="mt-2 h-1 w-full overflow-hidden rounded-full bg-secondary accent-primary"
                          />
                        )}
                    </div>
                  )}
                </div>
                <div className="min-w-0 border-t border-border bg-background/70 p-4 sm:p-5 lg:border-t-0 lg:border-l">
                  <p className="mb-4 flex justify-between text-[10px] text-muted-foreground">
                    <span>Recorded payload</span>
                    <span className="font-mono">JSON</span>
                  </p>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-6 text-primary">
                    <code>{selected.payload}</code>
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <p className="border-t border-border px-4 py-3 text-[10px] leading-5 text-muted-foreground sm:px-7">
        Completion describes execution. Missing terminal telemetry does not
        prove that work is active or failed.
      </p>
    </section>
  )
}
