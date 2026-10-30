import { Badge } from "@flowmark/ui"
import {
  overlineClassName,
  sectionTitleClassName,
  shellClassName,
} from "./shell"

const durations = [
  {
    name: "load-customers",
    duration: "0.8 s",
    width: "w-[10%]",
    offset: "ml-0",
  },
  {
    name: "validate-records",
    duration: "0.8 s",
    width: "w-[10%]",
    offset: "ml-[10%]",
  },
  {
    name: "sync-to-crm",
    duration: "6.7 s",
    width: "w-[80%]",
    offset: "ml-[20%]",
  },
] as const

export function ProductSection() {
  return (
    <section
      id="capabilities"
      className="py-16 sm:py-24"
      aria-labelledby="capabilities-title"
    >
      <div className={shellClassName}>
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-xl">
            <p className={overlineClassName}>From outcome to explanation</p>
            <h2
              id="capabilities-title"
              className={`${sectionTitleClassName} mt-4`}
            >
              The summary is the start.
              <br />
              The evidence is right there.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-7 text-muted-foreground">
            Start with what a process reported. Follow its milestones, inspect
            the work, and compare it with earlier executions.
          </p>
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <article className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="p-6 pb-0 sm:p-8 sm:pb-0">
              <span className="font-mono text-[10px] text-primary">
                01 / INSIDE ONE RUN
              </span>
              <h3 className="mt-3 text-2xl font-medium tracking-tight">
                Find the part that needs explaining.
              </h3>
              <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">
                Operations show where the time went. Milestones, progress,
                context, and handled errors keep the rest of the story attached.
              </p>
            </div>
            <figure className="m-5 mt-8 rounded-lg border border-border bg-background/70 p-5 sm:m-8">
              <figcaption className="mb-5 flex justify-between gap-2 text-[11px]">
                <span>Recorded operation timings</span>
                <span className="text-muted-foreground">
                  Example · 8.4 s run
                </span>
              </figcaption>
              <div className="mb-3 ml-[42%] flex justify-between font-mono text-[9px] text-muted-foreground">
                <span>0 s</span>
                <span>4 s</span>
                <span>8.4 s</span>
              </div>
              <ul className="space-y-4">
                {durations.map((op) => (
                  <li
                    key={op.name}
                    className="grid grid-cols-[42%_1fr] items-center gap-2"
                  >
                    <span className="truncate font-mono text-[10px] text-muted-foreground">
                      {op.name}
                    </span>
                    <span className="relative block h-7 border-l border-border bg-secondary/30">
                      <span
                        className={`absolute inset-y-1 block min-w-1 rounded-sm bg-primary/60 ${op.width} ${op.offset}`}
                      />
                      <span className="sr-only">{op.duration}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 border-t border-border pt-3 text-[10px] leading-5 text-muted-foreground">
                sync-to-crm took 6.7 s. A handled CRM_RATE_LIMIT was reported
                during this operation.
              </p>
            </figure>
          </article>
          <article className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="p-6 pb-0 sm:p-8 sm:pb-0">
              <span className="font-mono text-[10px] text-primary">
                02 / ACROSS EXECUTIONS
              </span>
              <h3 className="mt-3 text-2xl font-medium tracking-tight">
                See what changed. Open the runs.
              </h3>
              <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">
                Explore volume, completion, and duration trends. Compare
                operations and failure codes between seven-day windows, then
                inspect the recorded evidence.
              </p>
            </div>
            <figure className="m-5 mt-8 rounded-lg border border-border bg-background/70 p-5 sm:m-8">
              <figcaption className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px]">Run duration · daily p95</p>
                  <p className="mt-2 text-3xl font-medium tracking-tight tabular-nums">
                    9.1{" "}
                    <span className="text-base text-muted-foreground">
                      seconds
                    </span>
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="text-[9px] text-muted-foreground"
                >
                  Illustrative trend
                </Badge>
              </figcaption>
              <svg
                role="img"
                aria-labelledby="duration-chart-title duration-chart-desc"
                className="mt-4 h-24 w-full overflow-visible"
                viewBox="0 0 420 96"
                preserveAspectRatio="none"
              >
                <title id="duration-chart-title">
                  Illustrative p95 duration trend over seven days
                </title>
                <desc id="duration-chart-desc">
                  Daily p95 in seconds: 6.4, 6.9, 6.7, 7.8, 7.6, 9.4, 9.1.
                  Sample data, not live telemetry.
                </desc>
                <path
                  d="M0 20H420M0 50H420M0 80H420"
                  className="stroke-border"
                  strokeDasharray="3 5"
                  fill="none"
                />
                <path
                  d="M0 75 70 64 140 68 210 43 280 47 350 7 420 14"
                  fill="none"
                  className="stroke-primary"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
                <circle cx="420" cy="14" r="3" className="fill-primary" />
              </svg>
              <div className="mt-2 flex justify-between font-mono text-[9px] text-muted-foreground">
                <span>23 Oct</span>
                <span>29 Oct · UTC</span>
              </div>
              <p className="mt-4 border-t border-border pt-3 text-[10px] leading-5 text-muted-foreground">
                Follow execution performance alongside the business results
                those runs report.
              </p>
            </figure>
          </article>
        </div>
      </div>
    </section>
  )
}
