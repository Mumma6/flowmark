import Link from "next/link"
import { coverageDestination } from "./coverage-destination"

export function CoveragePage({
  status,
  question,
  repair,
}: {
  readonly status?: string
  readonly question?: string
  readonly repair?: string
}) {
  const view = coverageDestination({ status, question, repair })
  return (
    <section className="mx-auto grid max-w-2xl gap-8">
      <header className="grid gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Coverage and exceptions
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{view.title}</h1>
        {view.question ? (
          <p className="text-sm text-muted-foreground">
            Question <span className="font-medium text-foreground">{view.question}</span>
          </p>
        ) : null}
        <p className="text-sm leading-6">{view.explanation}</p>
      </header>
      <ul className="grid gap-2 text-sm sm:grid-cols-2">
        {(["unavailable", "waiting", "stale", "revoked", "forbidden"] as const).map(
          (item) => (
            <li key={item}>
              <Link
                href={`/coverage?status=${item}`}
                aria-current={view.status === item ? "page" : undefined}
                className="flex min-h-11 items-center rounded-md border border-border px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item}
              </Link>
            </li>
          ),
        )}
      </ul>
      <Link
        href={view.action.href}
        className="inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {view.action.label}
      </Link>
    </section>
  )
}
