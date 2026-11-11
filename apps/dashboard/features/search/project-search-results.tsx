"use client"

import { CommandGroup, CommandItem } from "@flowmark/ui"
import { ArrowUpRight, GitBranch, Tag, Workflow } from "lucide-react"
import type { RouterOutputs } from "../platform/api-types"
import type { ExplorerFilters } from "../runs/explorer/explorer-filters"
import { startJourneyHref } from "../journeys/journey-selection"
import { runStatusLabel } from "../runs/models/run-presentation"
import {
  distinctSearchReferences,
  referenceExploreHref,
  runHref,
  workflowExploreHref,
} from "./command-search"

export function ProjectSearchResults({
  results,
  filters,
  returnTo,
  go,
  projectId,
}: {
  results: RouterOutputs["search"]["project"]
  filters: ExplorerFilters
  returnTo: string
  go: (href: string) => void
  projectId: string
}) {
  const references = distinctSearchReferences(results.references)
  return (
    <>
      {results.workflows.length > 0 && (
        <CommandGroup heading="Processes">
          {results.workflows.map((workflow) => (
            <CommandItem
              key={workflow.name}
              value={`workflow:${workflow.name}`}
              className="gap-3 px-3 py-3"
              onSelect={() => go(workflowExploreHref(workflow.name, filters))}
            >
              <Workflow aria-hidden="true" className="text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-xs">
                  {workflow.name}
                </span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Explore execution evidence
                </span>
              </span>
              <ArrowUpRight
                aria-hidden="true"
                className="text-muted-foreground"
              />
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {references.length > 0 && (
        <CommandGroup heading="Business references · exact matches">
          {references.map((reference) => (
            <CommandItem
              key={JSON.stringify([
                reference.workflow,
                reference.key,
                reference.value,
              ])}
              value={`reference:${JSON.stringify([reference.workflow, reference.key, reference.value])}`}
              className="gap-3 px-3 py-3"
              onSelect={() =>
                go(
                  startJourneyHref(
                    projectId,
                    reference,
                    referenceExploreHref(reference, filters),
                  ),
                )
              }
            >
              <Tag aria-hidden="true" className="text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-xs">
                  {reference.key} = {reference.value}
                </span>
                <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                  {reference.workflow} · Follow reference journey
                </span>
              </span>
              <ArrowUpRight
                aria-hidden="true"
                className="text-muted-foreground"
              />
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {results.runs.length > 0 && (
        <CommandGroup heading="Runs">
          {results.runs.map((run) => (
            <CommandItem
              key={run.id}
              value={`run:${run.id}`}
              className="gap-3 px-3 py-3"
              onSelect={() => go(runHref(run.id, returnTo))}
            >
              <GitBranch aria-hidden="true" className="text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-xs">
                  {run.workflow}
                </span>
                <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                  {runStatusLabel(run.status)} · {run.externalId}
                  {run.failCode ? ` · ${run.failCode}` : ""}
                </span>
              </span>
              <ArrowUpRight
                aria-hidden="true"
                className="text-muted-foreground"
              />
            </CommandItem>
          ))}
        </CommandGroup>
      )}
    </>
  )
}
