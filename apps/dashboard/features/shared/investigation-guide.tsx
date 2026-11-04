import { ArrowRight } from "lucide-react"
import Link from "next/link"

/** Product navigation only; the application owns the meaning of its work. */
export function InvestigationGuide() {
  const paths = [
    {
      title: "Find what needs attention",
      description:
        "Open Issues for failed runs, missing confirmations and slower operations. Choose a period and workflow to narrow the evidence.",
      href: "/issues",
      action: "Investigate issues",
      outcome:
        "Leave with affected runs and evidence to investigate in your application.",
    },
    {
      title: "Understand what changed",
      description:
        "Open Insights to compare volume, completion and duration with the previous period. Select a workflow to inspect its reported results.",
      href: "/insights",
      action: "Compare periods",
      outcome:
        "Leave knowing which recorded measurements changed and which runs support the comparison.",
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
          className="group flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <h2 className="text-lg font-semibold">{path.title}</h2>
          <p className="text-base leading-7 text-muted-foreground">
            {path.description}
          </p>
          <p className="border-t border-border pt-4 text-sm leading-6 text-foreground">
            {path.outcome}
          </p>
          <span className="mt-auto flex items-center gap-2 pt-2 text-sm font-medium text-primary">
            {path.action}
            <ArrowRight aria-hidden="true" className="size-4" />
          </span>
        </Link>
      ))}
    </section>
  )
}
