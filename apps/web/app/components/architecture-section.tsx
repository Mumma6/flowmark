import { Button, Card, CardContent } from "@flowmark/ui"
import { Arrow } from "./brand"
import { overlineClassName, sectionTitleClassName, shellClassName } from "./shell"
import { docsUrl } from "./site-links"

const stages: ReadonlyArray<{
  icon: "{ }" | "arrow" | "data"
  title: string
  detail: string
  status: string
  link?: string
}> = [
  {
    icon: "{ }",
    title: "Your application",
    detail: "Existing business logic, marked",
    status: "Your code",
  },
  {
    icon: "arrow",
    title: "Flowmark API",
    detail: "Validates and stores event records",
    status: "Telemetry",
    link: "context · milestone · outcome",
  },
  {
    icon: "data",
    title: "Process detail",
    detail: "Review the events your code chose to report",
    status: "Context",
    link: "inspect that execution",
  },
]

function StageIcon({ icon }: { icon: (typeof stages)[number]["icon"] }) {
  if (icon === "arrow") {
    return <Arrow />
  }
  if (icon === "data") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
        <path
          d="M4 6.5C4 5.12 7.58 4 12 4s8 1.12 8 2.5S16.42 9 12 9 4 7.88 4 6.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M4 6.5v11C4 18.88 7.58 20 12 20s8-1.12 8-2.5v-11M4 12c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    )
  }
  return <span className="font-mono text-sm">{icon}</span>
}

export function ArchitectureSection() {
  return (
    <section className="border-b border-border bg-[#0b0f10] bg-[radial-gradient(ellipse_at_88%_12%,#b9f59705,transparent_54%)] py-16 sm:py-[6.25rem]">
      <div
        className={`${shellClassName} grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20`}
      >
        <div>
          <p className={overlineClassName}>From code to insight</p>
          <h2 className={`${sectionTitleClassName} mt-4`}>
            Mark a process. See the numbers.
          </h2>
          <p className="mt-5 max-w-[420px] text-[13px] leading-8 text-muted-foreground">
            Your application reports context, operations, progress, errors, and
            a result. Flowmark stores that evidence and turns it into volume,
            duration, and outcomes you can open.
          </p>
          <Button asChild className="mt-6" size="lg" variant="outline">
            <a href={docsUrl}>
              Explore the integration <Arrow diagonal />
            </a>
          </Button>
        </div>
        <Card
          className="rounded-lg border-white/10 bg-[#090e0f]"
          role="img"
          aria-label="An illustrative workflow lifecycle: application events are sent to the Flowmark API, persisted, and reviewed in a dashboard."
        >
          <CardContent className="space-y-0 p-4 sm:p-6">
            {stages.map((stage) => (
              <div key={stage.title}>
                {stage.link ? (
                  <div
                    className="flex min-h-10 items-center gap-3 pl-6 font-mono text-[8px] text-muted-foreground"
                    aria-hidden="true"
                  >
                    <span className="relative h-7 w-px bg-primary/30 after:absolute after:-bottom-px after:-left-[3px] after:size-1.5 after:rotate-45 after:border-r after:border-b after:border-[#9fc98c] after:content-['']" />
                    <span>{stage.link}</span>
                  </div>
                ) : null}
                <div className="flex min-w-0 items-center gap-3 rounded-md border border-white/10 bg-white/[0.02] px-3 py-4">
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded border border-primary/20 bg-primary/10 text-primary"
                    aria-hidden="true"
                  >
                    <StageIcon icon={stage.icon} />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <strong className="text-[11px] font-medium">
                      {stage.title}
                    </strong>
                    <small className="text-[9px] text-[#9aa99f]">
                      {stage.detail}
                    </small>
                  </span>
                  <span className="ml-auto font-mono text-[7px] tracking-wide whitespace-nowrap text-[#92a38f] uppercase">
                    {stage.status}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
