import { Badge } from "@flowmark/ui"
import {
  overlineClassName,
  sectionTitleClassName,
  shellClassName,
} from "./shell"

const perspectives = [
  {
    number: "01",
    role: "Engineering",
    question: "Why did this run behave differently?",
    detail:
      "Move from a reported result into operations, errors, progress, and peer comparisons. Share a direct link to the execution.",
    evidence: "Run → timeline → operation",
  },
  {
    number: "02",
    role: "Support & operations",
    question: "What happened to this customer’s process?",
    detail:
      "Find a case by a business reference and read its reported outcome in plain language, with the technical evidence one level deeper.",
    evidence: "Customer reference → case → explanation",
  },
  {
    number: "03",
    role: "Product",
    question: "Are we accomplishing more useful work?",
    detail:
      "Understand how declared business outcomes change over time. See imported, skipped, or rejected work across runs, then open the evidence.",
    evidence: "Outcome trend → affected runs",
  },
]

export function InsightsSection() {
  return (
    <section
      id="outcomes"
      className="relative isolate overflow-hidden border-y border-border bg-card/60 py-16 sm:py-24"
      aria-labelledby="outcomes-title"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_100%_0%,var(--hero-glow),transparent_65%)] opacity-40"
      />
      <div className={shellClassName}>
        <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr] md:items-end md:gap-16">
          <div>
            <p className={overlineClassName}>
              From individual runs to business results
            </p>
            <h2 id="outcomes-title" className={`${sectionTitleClassName} mt-4`}>
              One process.
              <br />A shared understanding.
            </h2>
          </div>
          <p className="text-sm leading-7 text-muted-foreground">
            Developers mark the process. Product, support, and operations see
            what it accomplishes. The same reported results connect the business
            question to the execution behind it.
          </p>
        </div>
        <figure className="mt-10 grid overflow-hidden rounded-xl border border-primary/20 bg-background/70 lg:grid-cols-[0.85fr_1.15fr]">
          <figcaption className="border-b border-border p-6 sm:p-8 lg:border-r lg:border-b-0">
            <Badge
              variant="outline"
              className="border-primary/30 text-[10px] text-primary"
            >
              Reported outcomes · sample data
            </Badge>
            <h3 className="mt-5 max-w-xs text-2xl leading-snug font-medium tracking-tight">
              From “did it finish?”
              <br />
              to “what did we achieve?”
            </h3>
            <p className="mt-3 max-w-sm text-sm leading-7 text-muted-foreground">
              Bring declared results together across executions. Understand the
              pattern, then follow it back to the individual runs.
            </p>
          </figcaption>
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap justify-between gap-2 text-xs">
              <span className="font-medium">
                Customer import · reported results
              </span>
              <span className="text-muted-foreground">23–29 Oct · UTC</span>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
              25 completed runs · all 25 report imported and skipped counts
            </p>
            <dl className="mt-7 grid grid-cols-2 gap-6">
              <div>
                <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full bg-primary"
                  />
                  Imported
                </dt>
                <dd className="mt-2 text-4xl font-medium tracking-tight tabular-nums">
                  24,700
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full bg-info"
                  />
                  Skipped
                </dt>
                <dd className="mt-2 text-4xl font-medium tracking-tight tabular-nums">
                  300
                </dd>
              </div>
            </dl>
            <div
              aria-hidden="true"
              className="mt-6 flex h-2 gap-1 overflow-hidden rounded-full"
            >
              <span className="w-[98.8%] rounded-full bg-primary/80" />
              <span className="min-w-1 flex-1 rounded-full bg-info/80" />
            </div>
            <p className="mt-3 text-[11px] leading-6 text-muted-foreground">
              25,000 records received. All counts are application-reported, with
              the reporting coverage and contributing runs kept visible.
            </p>
          </div>
        </figure>
        <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-0">
          {perspectives.map((item) => (
            <article
              key={item.role}
              className="border-t border-border pt-6 md:border-t-0 md:border-l md:px-7 md:pt-0 md:first:border-l-0 md:first:pl-0 md:last:pr-0"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono text-primary">{item.number}</span>
                <span>{item.role}</span>
              </div>
              <h3 className="mt-5 max-w-xs text-xl leading-snug font-medium tracking-tight">
                {item.question}
              </h3>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                {item.detail}
              </p>
              <p className="mt-6 font-mono text-[10px] leading-5 text-muted-foreground">
                {item.evidence}
              </p>
            </article>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-3 rounded-lg border border-border bg-background/60 p-5 sm:flex-row sm:gap-8">
          <span className="shrink-0 font-mono text-[10px] tracking-wide text-primary uppercase">
            When nothing happens
          </span>
          <p className="max-w-3xl text-xs leading-6 text-muted-foreground">
            Explicit expectations make missing confirmations and overdue
            outcomes visible, even when no exception is thrown. See what was
            reported, what was expected, and what has not been observed —
            without mistaking silence for a proven failure.
          </p>
        </div>
      </div>
    </section>
  )
}
