import { ArrowRight } from "lucide-react"
import Link from "next/link"

/** Product navigation only; the application owns the meaning of its work. */
export function InvestigationGuide() {
  const paths = [
    {
      title: "See why a question is unresolved",
      description:
        "Open Coverage for a question that is unavailable, waiting, stale, revoked or forbidden. Follow the owner action or the repair pull request.",
      href: "/coverage",
      action: "Review coverage",
      outcome:
        "Leave with the exception and a link to the owner action or repair.",
    },
    {
      title: "Inspect the cited evidence",
      description:
        "Open Evidence and follow a pull-request citation under your own grant. A refreshed citation stays separate from one that expired or is unavailable.",
      href: "/runs",
      action: "Open evidence",
      outcome:
        "Leave with the execution the citation names, or a clear reason it cannot be opened.",
    },
    {
      title: "Follow a specific execution",
      description:
        "Search Runs by ID or correlation, or choose a workflow and business reference. Open a run for its outcome, timeline and context.",
      href: "/runs",
      action: "Find a run",
      outcome:
        "Leave with an execution summary and identifiers you can use in your application logs.",
    },
  ]
  return (
    <section
      aria-label="Choose an investigation"
      className="grid gap-4 lg:grid-cols-3"
    >
      {paths.map((path) => (
        <Link
          key={path.href}
          href={path.href}
          className="group flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-highlight/40 hover:bg-highlight/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <h2 className="text-lg font-semibold">{path.title}</h2>
          <p className="text-base leading-7 text-muted-foreground">
            {path.description}
          </p>
          <p className="border-t border-border pt-4 text-sm leading-6 text-foreground">
            {path.outcome}
          </p>
          <span className="mt-auto flex items-center gap-2 pt-2 text-sm font-medium text-highlight">
            {path.action}
            <ArrowRight aria-hidden="true" className="size-4" />
          </span>
        </Link>
      ))}
    </section>
  )
}
