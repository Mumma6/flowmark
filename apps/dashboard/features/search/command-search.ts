import { Array as EffectArray } from "effect"
import { helpDestinations } from "../support/help-destinations"
import type { RouterOutputs } from "../platform/api-types"
import {
  explorerDefaults,
  exploreHref,
  type ExplorerFilters,
} from "../runs/explorer/explorer-filters"
import { runInvestigationPath } from "../runs/investigation/investigation-navigation"

export { exploreHref }

export const commandSearchDebounceMs = 300

export type CommandPage = {
  readonly id:
    | "connect"
    | "runs"
    | "coverage"
    | "settings"
    | "setup-help"
    | "documentation"
    | "troubleshooting"
    | "security-privacy"
    | "product-issue"
    | "private-support"
    | "security-report"
  readonly label: string
  readonly href: string
  readonly keywords: string
  readonly external: boolean
}

export function commandPages(docsUrl: string): readonly CommandPage[] {
  return [
    {
      id: "connect",
      label: "Connections and policy",
      href: "/connect",
      keywords: "connect access grants policy",
      external: false,
    },
    {
      id: "runs",
      label: "Evidence",
      href: "/runs",
      keywords: "history executions runs citation evidence",
      external: false,
    },
    {
      id: "coverage",
      label: "Coverage and exceptions",
      href: "/coverage",
      keywords:
        "coverage exceptions unavailable waiting stale revoked forbidden",
      external: false,
    },
    {
      id: "settings",
      label: "Settings",
      href: "/settings",
      keywords: "keys account project appearance",
      external: false,
    },
    {
      id: "setup-help",
      label: "Setup help",
      href: "/account/help",
      keywords: "help onboarding guide",
      external: false,
    },
    ...helpDestinations(docsUrl).map((destination) => ({
      id: destination.id,
      label: destination.label,
      href: destination.href,
      keywords: `docs ${destination.label} ${destination.description}`,
      external: true,
    })),
  ]
}

export function filterCommandPages(
  pages: readonly CommandPage[],
  query: string,
) {
  const term = query.trim().toLowerCase()
  if (!term) {
    return pages
  }
  return pages.filter((page) =>
    `${page.label} ${page.keywords}`.toLowerCase().includes(term),
  )
}

export function matchingProjects<
  T extends { readonly id: string; readonly name: string },
>(projects: readonly T[], query: string, limit = 5) {
  const term = query.trim().toLowerCase()
  if (!term) {
    return []
  }
  return projects
    .filter((project) => project.name.toLowerCase().includes(term))
    .slice(0, limit)
}

export function normalizeSearchQuery(query: string) {
  return query.trim().slice(0, 200)
}

export function shouldRequestProjectSearch(query: string) {
  return normalizeSearchQuery(query).length > 0
}

/** A process selection replaces text/reference scope, retaining evidence predicates. */
export function workflowExploreHref(
  name: string,
  filters: ExplorerFilters = explorerDefaults,
) {
  return exploreHref({
    ...filters,
    workflow: name,
    search: "",
    businessKey: "",
    businessValue: "",
  })
}

type SearchReference = RouterOutputs["search"]["project"]["references"][number]

/** References are exact, declared, workflow-qualified selections, never free text. */
export function referenceExploreHref(
  reference: Pick<SearchReference, "workflow" | "key" | "value">,
  filters: ExplorerFilters = explorerDefaults,
) {
  return exploreHref({
    ...filters,
    workflow: reference.workflow,
    businessKey: reference.key,
    businessValue: reference.value,
    search: "",
  })
}

export function runSearchExploreHref(
  query: string,
  filters: ExplorerFilters = explorerDefaults,
) {
  return exploreHref({ ...filters, search: normalizeSearchQuery(query) })
}

export function runHref(id: string, from: string) {
  return runInvestigationPath(id, from)
}

/** The bounded API returns matching runs; Studio offers each exact cohort once. */
export function distinctSearchReferences(
  references: readonly SearchReference[],
) {
  return EffectArray.dedupeWith(
    references,
    (a, b) =>
      a.workflow === b.workflow && a.key === b.key && a.value === b.value,
  )
}
