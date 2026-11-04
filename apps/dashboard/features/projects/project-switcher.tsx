"use client"

import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@flowmark/ui"
import { Folder, RotateCw } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"
import { useProject } from "./project-context"

export function ProjectSwitcher() {
  const { projects, current, pending, error, retry, select } = useProject()
  const items = useMemo(
    () =>
      Object.fromEntries(projects.map((project) => [project.id, project.name])),
    [projects],
  )
  if (error) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={retry}
        className="min-w-0 text-destructive"
        aria-label="Retry loading projects"
      >
        <RotateCw aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="truncate">Projects unavailable</span>
      </Button>
    )
  }
  if (pending && projects.length === 0) {
    return (
      <p role="status" className="truncate text-xs text-muted-foreground">
        Loading projects…
      </p>
    )
  }
  if (projects.length === 0) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/settings?section=projects">Create a project</Link>
      </Button>
    )
  }
  return (
    <div className="min-w-0">
      <label htmlFor="studio-project" className="sr-only">
        Project
      </label>
      <Select items={items} value={current?.id ?? null} onValueChange={select}>
        <SelectTrigger
          id="studio-project"
          className="h-9 w-full min-w-0 gap-2 border-transparent bg-transparent px-2 text-xs shadow-none hover:bg-secondary [&>span]:truncate"
        >
          <Folder
            aria-hidden="true"
            className="hidden size-3.5 shrink-0 text-muted-foreground sm:block"
          />
          <SelectValue placeholder="Choose a project" />
        </SelectTrigger>
        <SelectContent>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
