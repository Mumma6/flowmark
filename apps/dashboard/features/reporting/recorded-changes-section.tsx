import Link from "next/link"

export function RecordedChangesSection({
  changes,
}: {
  changes: readonly {
    readonly id: string
    readonly title: string
    readonly detail: string
    readonly href: string
  }[]
}) {
  return (
    <section aria-label="Recorded changes" className="grid gap-3">
      <div>
        <h2 className="text-base font-semibold">Worth a closer look</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          Failure codes that increased, workflows whose failed-run count rose
          after at least five finished runs in both windows, and operations
          whose median duration rose across at least three runs in each window.
          These are highlights, not verified incidents.
        </p>
      </div>
      {changes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No change met that display threshold.
        </p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {changes.map((change) => (
            <li key={change.id}>
              <Link
                href={change.href}
                className="block h-full rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:bg-muted/40"
              >
                <p className="font-medium">{change.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {change.detail}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
