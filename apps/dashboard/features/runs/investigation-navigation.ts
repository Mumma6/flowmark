import type { RunInvestigationSelection } from "@flowmarkdev/core"
import { Array as EffectArray, Match, Result, Schema } from "effect"
import { explorerDefaults } from "./explorer-filters"
import { runSelectionQueryKey } from "./investigation-selection"

const InvestigationSource = Schema.String.check(
  Schema.isPattern(
    /^\/(?:overview|runs|issues|insights|workflows(?:\/[^?/#\\\s]+)?)?(?:\?[^#\\\s]*)?$/,
  ),
)

const InspectorPath = Schema.String.check(
  Schema.isPattern(/^\/runs\/[a-zA-Z0-9_-]+$/),
)

/** Native Explore navigation keeps its mounted cohort; hard loads use RunPage. */
export function readInspectorRunId(pathname: string) {
  return Schema.decodeUnknownResult(InspectorPath)(pathname).pipe(
    Result.map((path) => path.slice("/runs/".length)),
    Result.getOrUndefined,
  )
}

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
          Match.when(
            (path) => path.startsWith("/overview"),
            () => "Back to Overview",
          ),
          Match.orElse(() => "Back to Explore"),
        ),
      }),
    }),
  )
}

export function runInvestigationPath(
  id: string,
  from?: string,
  view?: string,
  event?: string,
  selection?: RunInvestigationSelection,
) {
  const params = new URLSearchParams()
  // Explore remains mounted behind a contextual run location and reads the
  // current URL. Preserve its exact predicates, including invalid values.
  // Navigation context never grants project authority.
  const source = from ? investigationReturn(from).href : ""
  if (source.startsWith("/?")) {
    const cohort = new URLSearchParams(source.slice(2))
    EffectArray.forEach(
      EffectArray.fromIterable(Object.keys(explorerDefaults)),
      (key) => {
        const value = cohort.get(key)
        if (value !== null) {
          params.set(key, value)
        }
      },
    )
  }
  if (from) {
    params.set("from", from)
  }
  if (view) {
    params.set("view", view)
  }
  if (event) {
    params.set("event", event)
  }
  if (selection) {
    params.set(runSelectionQueryKey, JSON.stringify(selection))
  }
  return `/runs/${encodeURIComponent(id)}${params.size ? `?${params}` : ""}`
}
