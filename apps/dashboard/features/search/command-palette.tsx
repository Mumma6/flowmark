"use client"

import {
  Button,
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  DialogTrigger,
} from "@flowmark/ui"
import {
  ArrowUpRight,
  BookOpen,
  CircleAlert,
  Compass,
  Folder,
  GitBranch,
  LayoutDashboard,
  LineChart,
  Search,
  Settings,
  Workflow,
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useSyncExternalStore } from "react"
import { publicConfig } from "../platform/config-public"
import { explorerDefaults, readExplorerFilters } from "../runs/explorer-filters"
import { useProject } from "../projects/project-context"
import {
  commandPages,
  commandSearchDebounceMs,
  filterCommandPages,
  matchingProjects,
  normalizeSearchQuery,
  exploreHref,
  runSearchExploreHref,
  shouldRequestProjectSearch,
  type CommandPage,
} from "./command-search"
import { useProjectSearch } from "./queries"
import { ProjectSearchResults } from "./project-search-results"

const pageIcons = {
  explore: Compass,
  overview: LayoutDashboard,
  workflows: Workflow,
  runs: GitBranch,
  insights: LineChart,
  issues: CircleAlert,
  settings: Settings,
  documentation: BookOpen,
} satisfies Record<CommandPage["id"], typeof Workflow>

const subscribe = () => () => {}
const serverShortcut = () => "⌘K"
const clientShortcut = () =>
  /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘K" : "Ctrl K"

function useDebouncedQuery(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const normalized = normalizeSearchQuery(value)
    if (!normalized) {
      setDebounced("")
      return
    }
    const timeout = window.setTimeout(() => setDebounced(normalized), delay)
    return () => window.clearTimeout(timeout)
  }, [value, delay])
  return debounced
}

export function CommandPalette() {
  const { current } = useProject()
  // A project change discards open results and pending debounced text together.
  return <ProjectCommandPalette key={current?.id ?? "no-project"} />
}

function ProjectCommandPalette() {
  const router = useRouter()
  const params = useSearchParams()
  const filters = readExplorerFilters(params)
  const { projects, current, pending, select } = useProject()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const shortcut = useSyncExternalStore(
    subscribe,
    clientShortcut,
    serverShortcut,
  )
  const debounced = useDebouncedQuery(query, commandSearchDebounceMs)
  const typed = normalizeSearchQuery(query)
  const requested = shouldRequestProjectSearch(debounced)
  const settled = debounced === typed
  const search = useProjectSearch(
    requested ? debounced : "placeholder",
    open && requested && settled,
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || event.repeat || event.altKey) {
        return
      }
      if (!event.metaKey && !event.ctrlKey) {
        return
      }
      event.preventDefault()
      setOpen((currentOpen) => !currentOpen)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (!open) {
      setQuery("")
    }
  }, [open])

  const pages = filterCommandPages(
    commandPages(publicConfig.documentationUrl),
    query,
  )
  const projectMatches = matchingProjects(projects, query)
  const serverResults =
    settled && requested && !search.isError ? search.data : undefined
  const searching =
    Boolean(current) &&
    shouldRequestProjectSearch(typed) &&
    (!settled || search.isLoading)
  const failed = settled && requested && search.isError
  const showExplore =
    Boolean(current) && typed.length > 0 && !searching && !failed
  const needsProject = !pending && typed.length > 0 && !current
  const evidenceMatches =
    (serverResults?.workflows.length ?? 0) +
    (serverResults?.runs.length ?? 0) +
    (serverResults?.references.length ?? 0)
  const evidenceEmpty =
    Boolean(current) &&
    settled &&
    requested &&
    !failed &&
    !searching &&
    evidenceMatches === 0
  const hasFilters = Object.entries(filters).some(
    ([key, value]) =>
      value !== explorerDefaults[key as keyof typeof explorerDefaults],
  )
  const returnTo = hasFilters
    ? exploreHref(filters)
    : runSearchExploreHref(typed)

  function go(href: string, external = false) {
    setOpen(false)
    if (external) {
      window.location.assign(href)
      return
    }
    router.push(href)
  }

  return (
    <>
      <CommandDialog
        trigger={
          <DialogTrigger
            render={
              <Button
                type="button"
                variant="outline"
                className="size-9 shrink-0 border-transparent bg-transparent px-0 text-muted-foreground shadow-none sm:h-9 sm:w-72 sm:border-border sm:bg-card/60 sm:px-3"
                aria-label="Search"
                aria-keyshortcuts="Meta+K Control+K"
                aria-expanded={open}
                aria-haspopup="dialog"
              />
            }
          >
            <Search aria-hidden="true" />
            <span className="hidden min-w-0 flex-1 truncate text-left sm:inline">
              Search processes, runs, references…
            </span>
            <kbd className="hidden rounded border border-border bg-muted px-1.5 font-sans text-[10px] font-medium leading-5 sm:inline">
              {shortcut}
            </kbd>
          </DialogTrigger>
        }
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description="Search the selected project's processes, runs and explicitly enabled business references."
        className="top-[8vh] max-h-[84dvh] sm:top-[12vh] sm:max-w-2xl"
      >
        <Command shouldFilter={false} loop vimBindings={false} label="Search">
          <div className="flex min-w-0 items-center gap-2 border-b border-border bg-background/40 px-4 py-3 pr-12">
            <Compass
              aria-hidden="true"
              className="size-3.5 shrink-0 text-primary"
            />
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Studio search
            </span>
            <span aria-hidden="true" className="text-border">
              /
            </span>
            <span className="truncate text-xs">
              {current?.name ?? "No project selected"}
            </span>
          </div>
          <CommandInput
            autoFocus
            value={query}
            onValueChange={(value) => setQuery(value.slice(0, 200))}
            placeholder="A process, run ID or exact reference…"
            className="h-11 text-sm"
            aria-label="Search query"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault()
                setOpen(false)
              }
            }}
          />
          <CommandList
            className="max-h-[48dvh] p-2 sm:max-h-[26rem]"
            aria-busy={searching}
          >
            {searching && (
              <p
                className="px-3 py-2 text-sm text-muted-foreground"
                role="status"
              >
                Searching…
              </p>
            )}
            {failed && (
              <div
                className="flex items-center justify-between gap-3 px-3 py-2"
                role="alert"
              >
                <p className="text-sm">Could not search this project.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void search.refetch()}
                >
                  Retry
                </Button>
              </div>
            )}
            {evidenceEmpty && (
              <p
                className="px-4 py-6 text-center text-xs leading-6 text-muted-foreground"
                role="status"
              >
                No processes, runs or exact references found in this project.
              </p>
            )}
            {serverResults && (
              <ProjectSearchResults
                results={serverResults}
                filters={filters}
                returnTo={returnTo}
                go={go}
              />
            )}
            {showExplore && (
              <CommandGroup heading="Explore">
                <CommandItem
                  value={`explore:${typed}`}
                  onSelect={() => go(runSearchExploreHref(typed, filters))}
                  className="gap-3 px-3 py-3"
                >
                  <Search aria-hidden="true" className="text-primary" />
                  <span className="min-w-0 flex-1 truncate text-xs">
                    Filter execution evidence by “{typed}”
                  </span>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="text-muted-foreground"
                  />
                </CommandItem>
              </CommandGroup>
            )}
            {pages.length > 0 && (
              <CommandGroup heading="Navigate">
                {pages.map((page) => {
                  const Icon = pageIcons[page.id]
                  return (
                    <CommandItem
                      key={page.id}
                      value={`page:${page.id}`}
                      onSelect={() => go(page.href, page.external)}
                    >
                      <Icon aria-hidden="true" />
                      <span className="truncate">{page.label}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}
            {projectMatches.length > 0 && (
              <CommandGroup heading="Projects">
                {projectMatches.map((project) => (
                  <CommandItem
                    key={project.id}
                    value={`project:${project.id}`}
                    onSelect={() => {
                      select(project.id)
                      go("/")
                    }}
                  >
                    <Folder aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">
                      {project.name}
                    </span>
                    {project.id === current?.id && (
                      <span className="text-xs text-muted-foreground">
                        Current
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {needsProject && (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Select a project to search processes, runs and references.
              </p>
            )}
          </CommandList>
          <div className="border-t border-border bg-background/40 px-4 py-3 text-[11px] leading-5 text-muted-foreground">
            <p>
              Run text matches IDs, process names, correlation and failure
              codes. References match explicitly enabled fields exactly.
            </p>
            {hasFilters && (
              <p className="mt-1 text-foreground/80">
                Explore selections retain your current status, time and evidence
                filters.
              </p>
            )}
            <p
              className="mt-2 hidden gap-4 font-mono text-[10px] sm:flex"
              aria-hidden="true"
            >
              <span>↑ ↓ navigate</span>
              <span>↵ open</span>
              <span>esc close</span>
            </p>
          </div>
        </Command>
      </CommandDialog>
    </>
  )
}
