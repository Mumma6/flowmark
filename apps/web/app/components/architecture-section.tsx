import { FlowmarkMark } from "@flowmark/ui"
import {
  overlineClassName,
  sectionTitleClassName,
  shellClassName,
} from "./shell"

export function ArchitectureSection() {
  return (
    <section
      id="positioning"
      className="py-16 sm:py-24"
      aria-labelledby="positioning-title"
    >
      <div className={shellClassName}>
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:gap-20">
          <div className="min-w-0">
            <p className={overlineClassName}>
              Fits the application you already have
            </p>
            <h2
              id="positioning-title"
              className={`${sectionTitleClassName} mt-4`}
            >
              Keep your runtime.
              <br />
              Add understanding.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">
              An import script. A background worker. A checkout. A process that
              continues across requests. Mark the work where it already happens.
            </p>
            <div className="mt-8 flex min-w-0 items-center gap-2 rounded-lg border border-border bg-card p-4 text-xs sm:gap-3 sm:p-5">
              <span className="shrink-0 rounded border border-border bg-background px-2 py-2 font-mono text-[10px] sm:px-3 sm:text-xs">
                Your application
              </span>
              <span
                className="flex-1 border-t border-dashed border-primary/40"
                aria-hidden="true"
              />
              <span className="text-[10px] text-muted-foreground">
                <span className="hidden sm:inline">telemetry </span>→
              </span>
              <span className="flex items-center gap-2 font-medium">
                <FlowmarkMark className="size-5 text-primary" />
                Flowmark
              </span>
            </div>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              Your code owns execution, scheduling, and retries. Flowmark
              observes what it reports.
            </p>
          </div>
          <div className="min-w-0 divide-y divide-border border-y border-border">
            {[
              {
                title: "Alongside your logs",
                detail:
                  "Logs preserve individual messages. Flowmark groups explicit milestones, progress, and results into a named process and its runs.",
              },
              {
                title: "Alongside your APM",
                detail:
                  "APM helps explain service and request performance. Flowmark gives the application process its own lifecycle, reported result, and investigation view.",
              },
              {
                title: "Without adopting a workflow engine",
                detail:
                  "Keep your existing functions, queue, or job runner. Flowmark does not execute, schedule, or retry application work.",
              },
            ].map((item) => (
              <article key={item.title} className="py-6">
                <h3 className="text-base font-medium tracking-tight">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {item.detail}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
