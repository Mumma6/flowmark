"use client"

import {
  Button,
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@flowmark/ui"
import {
  BookOpen,
  CircleAlert,
  Compass,
  Folder,
  GitBranch,
  LayoutDashboard,
  LineChart,
  Search,
  Settings,
  Tag,
  Workflow,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useSyncExternalStore } from "react"
import { publicConfig } from "../platform/config-public"
import { runStatusLabel } from "../runs/run-presentation"
import { useProject } from "../projects/project-context"
import {
  commandPages,
  commandSearchDebounceMs,
  filterCommandPages,
  matchingProjects,
  normalizeSearchQuery,
  runHistoryHref,
  runHref,
  shouldRequestProjectSearch,
  workflowHref,
  type CommandPage,
} from "./command-search"
import { useProjectSearch } from "./queries"

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
  const router = useRouter()
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
  const serverResults = settled && requested ? search.data : undefined
  const searching =
    Boolean(current) &&
    shouldRequestProjectSearch(typed) &&
    (!settled || search.isLoading)
  const failed = settled && requested && search.isError
  const showRunHistory = Boolean(current) && typed.length > 0
  const needsProject = !pending && typed.length > 0 && !current
  const catalogMatches =
    pages.length +
    projectMatches.length +
    (serverResults?.workflows.length ?? 0) +
    (serverResults?.runs.length ?? 0) +
    (serverResults?.references.length ?? 0)
  const catalogEmpty =
    settled && requested && !failed && !searching && catalogMatches === 0

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
      <Button
        type="button"
        variant="outline"
        className="size-10 shrink-0 border-transparent bg-transparent px-0 text-muted-foreground shadow-none sm:h-9 sm:w-60 sm:border-border sm:bg-card/60 sm:px-3"
        aria-label="Search"
        aria-keyshortcuts="Meta+K Control+K"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Search aria-hidden="true" />
        <span className="hidden min-w-0 flex-1 truncate text-left sm:inline">
          Find in your workspace…
        </span>
        <kbd className="hidden rounded border border-border bg-muted px-1.5 font-sans text-[10px] font-medium leading-5 sm:inline">
          {shortcut}
        </kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description="Search pages, projects, workflows, runs and enabled business references."
      >
        <Command shouldFilter={false} loop vimBindings={false} label="Search">
          <CommandInput
            autoFocus
            value={query}
            onValueChange={(value) => setQuery(value.slice(0, 200))}
            placeholder="Workflows, runs, projects, pages…"
            aria-label="Search query"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault()
                setOpen(false)
              }
            }}
          />
          <CommandList>
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
            {catalogEmpty && (
              <p
                className="px-3 py-2 text-sm text-muted-foreground"
                role="status"
              >
                No matches.
              </p>
            )}
            {pages.length > 0 && (
              <CommandGroup heading="Pages">
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
            {(serverResults?.workflows.length ?? 0) > 0 && (
              <CommandGroup heading="Workflows">
                {serverResults?.workflows.map((workflow) => (
                  <CommandItem
                    key={workflow.name}
                    value={`workflow:${workflow.name}`}
                    onSelect={() => go(workflowHref(workflow.name))}
                  >
                    <Workflow aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">
                      {workflow.name}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {showRunHistory && (
              <CommandGroup heading="Runs">
                {serverResults?.runs.map((run) => (
                  <CommandItem
                    key={run.id}
                    value={`run:${run.id}`}
                    onSelect={() => go(runHref(run.id))}
                  >
                    <GitBranch aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{run.workflow}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {runStatusLabel(run.status)} ·{" "}
                        <span className="font-mono">{run.externalId}</span>
                        {run.failCode ? ` · ${run.failCode}` : ""}
                      </span>
                    </span>
                  </CommandItem>
                ))}
                <CommandItem
                  value={`run-history:${typed}`}
                  onSelect={() => go(runHistoryHref(typed))}
                >
                  <Search aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">
                    Open run history for “{typed}”
                  </span>
                </CommandItem>
              </CommandGroup>
            )}
            {(serverResults?.references.length ?? 0) > 0 && (
              <CommandGroup heading="Business references">
                {serverResults?.references.map((reference) => (
                  <CommandItem
                    key={`${reference.runId}:${reference.key}`}
                    value={`reference:${reference.runId}:${reference.key}`}
                    onSelect={() => go(runHref(reference.runId))}
                  >
                    <Tag aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-xs">
                        {reference.key}={reference.value}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {reference.workflow} · {reference.externalId}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {needsProject && (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Select a project to search workflows and runs.
              </p>
            )}
          </CommandList>
          <p className="border-t border-border px-3 py-2 text-xs leading-5 text-muted-foreground">
            Run search matches ids, workflow names, correlation and fail codes.
            Business references match enabled fields exactly.
          </p>
        </Command>
      </CommandDialog>
    </>
  )
}
