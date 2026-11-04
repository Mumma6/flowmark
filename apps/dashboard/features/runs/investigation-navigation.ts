import { Match, Result, Schema } from "effect"

const InvestigationSource = Schema.String.check(
  Schema.isPattern(
    /^\/(?:runs|issues|insights|workflows(?:\/[^?/#\\\s]+)?)?(?:\?[^#\\\s]*)?$/,
  ),
)

/** Unknown return links fall back to the project run list, never another site. */
export function investigationReturn(value: unknown) {
  return Schema.decodeUnknownResult(InvestigationSource)(value).pipe(
    Result.match({
      onFailure: () => ({ href: "/runs", label: "All runs" }),
      onSuccess: (href) => ({
        href,
        label: Match.value(href).pipe(
          Match.when(
            (path) => path.startsWith("/runs"),
            () => "Back to run results",
          ),
          Match.when(
            (path) => path.startsWith("/workflows"),
            () => "Back to workflow",
          ),
          Match.when(
            (path) => path.startsWith("/issues"),
            () => "Back to Issues",
          ),
          Match.when(
            (path) => path.startsWith("/insights"),
            () => "Back to Insights",
          ),
          Match.orElse(() => "Back to Overview"),
        ),
      }),
    }),
  )
}

export function runInvestigationPath(id: string, from?: string, view?: string) {
  const params = new URLSearchParams()
  if (from) {
    params.set("from", from)
  }
  if (view) {
    params.set("view", view)
  }
  return `/runs/${encodeURIComponent(id)}${params.size ? `?${params}` : ""}`
}
