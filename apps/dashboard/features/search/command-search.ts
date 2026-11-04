export const commandSearchDebounceMs = 300

export type CommandPage = {
  readonly id:
    | "explore"
    | "overview"
    | "workflows"
    | "runs"
    | "insights"
    | "issues"
    | "settings"
    | "documentation"
  readonly label: string
  readonly href: string
  readonly keywords: string
  readonly external: boolean
}

export function commandPages(docsUrl: string): readonly CommandPage[] {
  return [
    {
      id: "explore",
      label: "Explore",
      href: "/",
      keywords: "home studio evidence",
      external: false,
    },
    {
      id: "overview",
      label: "Project overview",
      href: "/overview",
      keywords: "dashboard summary",
      external: false,
    },
    {
      id: "workflows",
      label: "Processes",
      href: "/workflows",
      keywords: "directory workflows",
      external: false,
    },
    {
      id: "runs",
      label: "Execution history",
      href: "/runs",
      keywords: "history executions runs",
      external: false,
    },
    {
      id: "insights",
      label: "Insights",
      href: "/insights",
      keywords: "trends outcomes analytics performance",
      external: false,
    },
    {
      id: "issues",
      label: "Attention",
      href: "/issues",
      keywords: "issues failures problems errors investigate",
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
      id: "documentation",
      label: "Documentation",
      href: docsUrl,
      keywords: "docs help",
      external: true,
    },
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

export function workflowHref(name: string) {
  return `/workflows/${encodeURIComponent(name)}`
}

export function runHref(id: string) {
  return `/runs/${id}`
}

export function runHistoryHref(query: string) {
  return `/runs?search=${encodeURIComponent(normalizeSearchQuery(query))}`
}
