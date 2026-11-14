"use client"
import { Badge } from "./badge"
export interface BusinessRunViewProps {
  readonly summary: {
    readonly id: string
    readonly workflow: string
    readonly status: "Completed" | "Failed" | "Running"
    readonly outcome: string | null
    readonly startedAt: string
    readonly durationMs: number | null
  }
  readonly fields: readonly {
    readonly revision: string
    readonly path: readonly string[]
    readonly label: string
    readonly unit: string | null
    readonly kind: "count" | "category" | "reasons"
    readonly state: "available" | "missing" | "wrong-type" | "unknown-category"
    readonly value:
      | number
      | string
      | readonly { readonly value: string; readonly count: number }[]
      | null
  }[]
  readonly references: readonly {
    readonly key: string
    readonly value: string
  }[]
  readonly revision: number
  readonly observedAt: string
}
/** Supplied projected evidence only; no transport, credentials or diagnostic fallback. */
export function BusinessRunView({
  summary,
  fields,
  references,
  revision,
  observedAt,
}: BusinessRunViewProps) {
  return (
    <article
      aria-label="Published business run"
      className="grid min-w-0 gap-5 rounded-xl border border-border bg-card p-5 text-card-foreground"
    >
      <header className="grid gap-2">
        <p className="text-xs text-muted-foreground">
          Business evidence · publication {revision}
        </p>
        <h2 className="break-words text-xl font-semibold">
          {summary.workflow}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            {summary.status === "Running"
              ? "No terminal reported"
              : summary.status}
          </Badge>
          {summary.outcome ? (
            <Badge variant="outline">Reported outcome: {summary.outcome}</Badge>
          ) : (
            <span className="text-sm text-muted-foreground">
              No business outcome reported
            </span>
          )}
        </div>
      </header>
      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Started</dt>
          <dd>
            <time dateTime={summary.startedAt}>
              {new Date(summary.startedAt).toLocaleString()}
            </time>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Recorded duration</dt>
          <dd>
            {summary.durationMs === null
              ? "Not recorded"
              : `${summary.durationMs} ms`}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Internal run reference</dt>
          <dd className="break-all font-mono text-xs">{summary.id}</dd>
        </div>
      </dl>
      <section aria-label="Published result fields" className="grid gap-3">
        <h3 className="font-medium">Reported business results</h3>
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No result fields are published for this run's reported revision.
            Unpublished fields are withheld.
          </p>
        ) : (
          fields.map((field) => (
            <div
              className="rounded-lg border border-border p-3"
              key={JSON.stringify([field.revision, field.path])}
            >
              <p className="text-sm font-medium">
                {field.label}
                {field.unit ? ` · ${field.unit}` : ""}
              </p>
              <p className="break-words text-lg">
                {field.state !== "available"
                  ? {
                      missing: "No permitted value reported",
                      "wrong-type": "Reported value has the wrong type",
                      "unknown-category":
                        "Reported category is outside the published vocabulary",
                    }[field.state]
                  : Array.isArray(field.value)
                    ? field.value
                        .map((entry) => `${entry.value}: ${entry.count}`)
                        .join(" · ")
                    : String(field.value)}
              </p>
              <p className="text-xs text-muted-foreground">
                Revision {field.revision}
              </p>
            </div>
          ))
        )}
      </section>
      {references.length ? (
        <section aria-label="Published references" className="grid gap-2">
          <h3 className="font-medium">Published references</h3>
          {references.map((ref) => (
            <p key={ref.key} className="break-all text-sm">
              <span className="text-muted-foreground">{ref.key}: </span>
              {ref.value}
            </p>
          ))}
        </section>
      ) : null}
      <footer className="grid gap-2 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
        <p>
          Raw properties, unpublished results, external IDs, errors, operations
          and diagnostic downloads are withheld.
        </p>
        <p>
          Application-reported evidence. Completed does not mean every record
          succeeded. Missing terminal telemetry does not establish liveness or
          failure.
        </p>
        <p>
          Observed{" "}
          <time dateTime={observedAt}>
            {new Date(observedAt).toLocaleString()}
          </time>
          . Downloaded copies do not prove current access.
        </p>
      </footer>
    </article>
  )
}
