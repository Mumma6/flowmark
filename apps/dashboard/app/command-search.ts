export const commandSearchDebounceMs = 300

export const documentationUrl =
  process.env.NEXT_PUBLIC_FLOWMARK_DOCS_URL ??
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3002/docs/introduction"
    : "https://docs.flowmark.dev/docs/introduction")

export type CommandPage = {
  readonly id: "overview" | "workflows" | "runs" | "settings" | "documentation"
  readonly label: string
  readonly href: string
  readonly keywords: string
  readonly external: boolean
}

export function commandPages(docsUrl: string): readonly CommandPage[] {
  return [
    {
      id: "overview",
      label: "Overview",
      href: "/",
      keywords: "home dashboard",
      external: false,
    },
    {
      id: "workflows",
      label: "Workflows",
      href: "/workflows",
      keywords: "directory",
      external: false,
    },
    {
      id: "runs",
      label: "Runs",
      href: "/runs",
      keywords: "history executions",
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
