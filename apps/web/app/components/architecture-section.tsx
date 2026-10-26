import { Button } from "@flowmark/ui"
import { Arrow } from "./brand"
import { overlineClassName, sectionTitleClassName, shellClassName } from "./shell"
import { docsUrl } from "./site-links"

const contrasts = [
  {
    alternative: "APM and OpenTelemetry",
    strength: "Flexible traces, logs, and metrics",
    distinction:
      "an opinionated workflow and run model — investigation and reported outcomes without a custom dashboard",
  },
  {
    alternative: "Workflow engines",
    strength: "Inspection of work they execute",
    distinction:
      "observation of existing application code, without moving that code into an engine",
  },
  {
    alternative: "Job monitors and error trackers",
    strength: "Health, duration, and failures",
    distinction:
      "a full account of a process: milestones, operations, recovery, progress, and what it reported accomplishing",
  },
] as const

export function ArchitectureSection() {
  return (
    <section
      id="positioning"
      className="border-y border-border bg-[#0b0f10] bg-[radial-gradient(ellipse_at_88%_12%,#b9f59705,transparent_54%)] py-16 sm:py-[6.25rem]"
      aria-labelledby="positioning-title"
    >
      <div className={shellClassName}>
        <div className="max-w-2xl">
          <p className={overlineClassName}>Where Flowmark sits</p>
          <h2
            id="positioning-title"
            className={`${sectionTitleClassName} mt-4`}
          >
            Between job monitoring and general observability.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
            The application names the process and reports the evidence.
            Flowmark does not infer a business process from generic traces,
            and it does not take over the work.
          </p>
        </div>
        <ul className="mt-12 space-y-0 border-t border-border">
          {contrasts.map((row) => (
            <li
              key={row.alternative}
              className="grid gap-3 border-b border-border py-6 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:gap-10 sm:py-7"
            >
              <div>
                <p className="text-[15px] font-medium tracking-tight">
                  {row.alternative}
                </p>
                <p className="mt-1 text-[12px] leading-6 text-muted-foreground">
                  Strong at {row.strength.toLowerCase()}
                </p>
              </div>
              <p className="text-sm leading-7 text-foreground/90">
                Flowmark gives you {row.distinction}.
              </p>
            </li>
          ))}
        </ul>
        <Button asChild className="mt-10" size="lg" variant="outline">
          <a href={docsUrl}>
            Explore the integration <Arrow diagonal />
          </a>
        </Button>
      </div>
    </section>
  )
}
